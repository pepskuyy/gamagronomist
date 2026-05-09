const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    include: { product: true }
  });
  const affected = ledgers.filter(l => ['TRANSFER_TO_FO', 'RECEIVE_FROM_AFA'].includes(l.transactionType) || (l.transactionType === 'STOCK_IN_GUDANG' && !l.referenceId));
  
  const migrated = affected.filter(l => Math.abs(l.quantity) >= (l.product.gramasiPerUnit || Infinity));
  const unmigrated = affected.filter(l => Math.abs(l.quantity) < (l.product.gramasiPerUnit || Infinity));
  
  console.log(`Migrated: ${migrated.length}, Unmigrated: ${unmigrated.length}`);
  console.log('Sample Unmigrated:', unmigrated.slice(0, 5).map(l => ({ id: l.id, qty: l.quantity, g: l.product.gramasiPerUnit })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
