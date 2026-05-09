const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { product: { name: 'Biolon 670 EC 100 ml' } }
  });
  console.log(ledgers.map(l => ({ qty: l.quantity, type: l.transactionType })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
