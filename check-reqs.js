const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const reqs = await prisma.requestDetail.findMany({
    where: { product: { name: 'Stadium 18 EC 1 L' } },
    include: { request: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(reqs.map(r => ({
    id: r.requestId,
    qtyReq: r.qtyRequested,
    qtyApp: r.qtyApproved,
    date: r.createdAt
  })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
