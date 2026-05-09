const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  const ledgers = await prisma.ledger.findMany({
    include: { product: true }
  });

  let updatedCount = 0;

  for (const l of ledgers) {
    const gramasi = l.product.gramasiPerUnit;
    if (!gramasi || gramasi <= 0) continue;

    let shouldMultiply = false;

    if (['TRANSFER_TO_FO', 'RECEIVE_FROM_AFA'].includes(l.transactionType)) {
      // These were recorded in kemasan (FO requesting bottles)
      shouldMultiply = true;
    } else if (l.transactionType === 'STOCK_IN_GUDANG' && !l.referenceId) {
      // Sample flow: recorded in kemasan
      shouldMultiply = true;
    }

    if (shouldMultiply) {
      const newQty = l.quantity * gramasi;
      await prisma.ledger.update({
        where: { id: l.id },
        data: { quantity: newQty }
      });
      updatedCount++;
      console.log(`Updated Ledger ${l.id} (${l.product.name}): ${l.quantity} -> ${newQty}`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} ledgers.`);
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
