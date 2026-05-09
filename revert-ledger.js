const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revert() {
  const ledgers = await prisma.ledger.findMany({
    include: { product: true }
  });

  let revertedCount = 0;

  for (const l of ledgers) {
    const gramasi = l.product.gramasiPerUnit;
    if (!gramasi || gramasi <= 0) continue;

    // Do not touch USAGE, as it was never multiplied by anything (always entered purely in ml)
    const isUsage = ['USAGE_SPOT_DEMOPLOT', 'USAGE_DEMOPLOT'].includes(l.transactionType);
    if (isUsage) continue;

    // Divide by gramasiPerUnit to return the quantity to exactly what the user originally typed!
    const revertedQty = l.quantity / gramasi;
    
    await prisma.ledger.update({
      where: { id: l.id },
      data: { quantity: revertedQty }
    });
    
    revertedCount++;
  }

  console.log(`Reversion complete. Successfully divided ${revertedCount} rows by their gramasiPerUnit.`);
}

revert().catch(console.error).finally(() => prisma.$disconnect());
