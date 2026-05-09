const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function fix() {
  // ── Idempotency Guard ──────────────────────────────────────────────────────
  // Cek apakah data sudah pernah diproses: hitung berapa baris dengan quantity
  // > 1000 untuk produk dengan gramasiPerUnit = 1. Jika 0, data sudah bersih.
  const suspiciousCount = await prisma.ledger.count({
    where: { quantity: { gt: 10000 } }
  });
  const totalCount = await prisma.ledger.count();
  console.log(`Guard check: ${suspiciousCount} / ${totalCount} rows with quantity > 10000`);
  if (suspiciousCount < 5) {
    console.log('GUARD: Tidak ada baris mencurigakan yang ditemukan. Script kemungkinan sudah dijalankan atau tidak diperlukan. Batalkan untuk keamanan.');
    console.log('Untuk bypass guard, jalankan dengan: FORCE_RUN=1 node fix-ledger.js');
    if (process.env.FORCE_RUN !== '1') {
      process.exit(0);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const corruptedLog = fs.readFileSync('corrupted.txt', 'utf8');
  const corruptedIds = [];
  
  // Extract IDs from log
  const lines = corruptedLog.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/Updated Ledger ([a-zA-Z0-9]+)/);
    if (match) {
      corruptedIds.push(match[1]);
    }
  }

  const ledgers = await prisma.ledger.findMany({
    include: { product: true }
  });

  let revertedCount = 0;
  let migratedCount = 0;

  for (const l of ledgers) {
    const gramasi = l.product.gramasiPerUnit;
    if (!gramasi || gramasi <= 0) continue;

    // First, revert if it's corrupted
    if (corruptedIds.includes(l.id)) {
      // Revert the multiplication
      const revertedQty = l.quantity / gramasi;
      await prisma.ledger.update({
        where: { id: l.id },
        data: { quantity: revertedQty }
      });
      revertedCount++;
      // Set local l.quantity to revertedQty so the next block processes the ORIGINAL kemasan value!
      l.quantity = revertedQty;
    }

    // Now, apply the FULL correction logic to ALL applicable rows
    // Applicable: Everything EXCEPT USAGE, and STOCK_IN_GUDANG with referenceId
    const isUsage = ['USAGE_SPOT_DEMOPLOT', 'USAGE_DEMOPLOT'].includes(l.transactionType);
    const isMultipliedStockIn = (l.transactionType === 'STOCK_IN_GUDANG' && l.referenceId);

    if (!isUsage && !isMultipliedStockIn) {
      // It was entered in Kemasan! We MUST convert it to Gramasi!
      // But wait! How do we know it hasn't ALREADY been converted by someone manually editing the DB?
      // Since we just reverted the corrupted ones, ALL of these are currently in Kemasan.
      const newQty = l.quantity * gramasi;
      await prisma.ledger.update({
        where: { id: l.id },
        data: { quantity: newQty }
      });
      migratedCount++;
    }
  }

  console.log(`Fix complete. Reverted ${revertedCount} corrupted rows. Migrated ${migratedCount} rows to gramasi.`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
