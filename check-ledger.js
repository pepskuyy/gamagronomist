const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const ledgers = await prisma.ledger.findMany({
    where: { product: { name: 'Stadium 18 EC 1 L' } },
    include: { user: true }
  });
  const grouped = {};
  ledgers.forEach(l => {
    if (!grouped[l.user.name]) grouped[l.user.name] = 0;
    grouped[l.user.name] += l.quantity;
  });
  console.log('Stadium 18 EC 1 L balance per user:');
  console.log(grouped);
}

check().catch(console.error).finally(() => prisma.$disconnect());
