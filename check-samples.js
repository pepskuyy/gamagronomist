const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const ledgers = await prisma.sampleLedger.findMany({
    include: { product: true }
  });
  console.log(ledgers.map(l => ({ name: l.product.name, qty: l.quantity })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
