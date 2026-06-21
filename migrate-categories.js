const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sops = await prisma.sop.findMany({ select: { category: true } })
  const existingCategories = new Set(['Gudang', 'Lapangan', 'Administrasi', 'Keuangan', 'Umum'])
  sops.forEach(s => existingCategories.add(s.category))

  for (const cat of existingCategories) {
    await prisma.sopCategory.upsert({
      where: { name: cat },
      update: {},
      create: { name: cat }
    })
  }
  console.log('Categories migrated')
}

main().catch(console.error).finally(() => prisma.$disconnect())
