const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { product: { name: 'Bestzine 20/60 WG 100 gram' } }
  });
  console.log(ledgers.map(l => ({ qty: l.quantity, type: l.transactionType })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
