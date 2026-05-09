const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.findMany({ where: { name: { contains: 'SPV', mode: 'insensitive' } } });
  console.log(users.map(u => ({ id: u.id, name: u.name, role: u.role })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
