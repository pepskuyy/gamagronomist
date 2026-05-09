const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { product: { name: 'Fra Red 500 ml' }, user: { name: 'Orbit Bimasakti Akbar' } }
  });
  console.log('FRA RED:', ledgers.reduce((acc, l) => acc + l.quantity, 0));
}
check().catch(console.error).finally(() => prisma.$disconnect());
