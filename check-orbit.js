const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { user: { name: 'Orbit Bimasakti Akbar' }, product: { name: 'Stadium 18 EC 1 L' } }
  });
  console.log(ledgers.map(l => ({ qty: l.quantity, type: l.transactionType })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
