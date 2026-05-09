const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({ include: { product: true } });
  console.log('Total ledgers:', ledgers.length);
  const big = ledgers.filter(l => Math.abs(l.quantity) > 10000).length;
  const small = ledgers.filter(l => Math.abs(l.quantity) <= 10000).length;
  console.log('Big (>10k):', big, 'Small (<=10k):', small);
  const affected = ledgers.filter(l => ['TRANSFER_TO_FO', 'RECEIVE_FROM_AFA'].includes(l.transactionType) || (l.transactionType === 'STOCK_IN_GUDANG' && !l.referenceId));
  console.log('Affected rows total:', affected.length);
}
check().catch(console.error).finally(() => prisma.$disconnect());
