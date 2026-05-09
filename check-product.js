const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const p = await prisma.product.findFirst({ where: { name: 'Stadium 18 EC 1 L' } });
  console.log('STADIUM:', { unitGramasi: p.unitGramasi, gramasiPerUnit: p.gramasiPerUnit, unit: p.unit });
}
check().catch(console.error).finally(() => prisma.$disconnect());
