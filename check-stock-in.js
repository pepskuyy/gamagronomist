const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { transactionType: 'STOCK_IN_GUDANG', referenceId: { not: null } }
  });
  console.log(ledgers.map(l => ({ qty: l.quantity, type: l.transactionType })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
