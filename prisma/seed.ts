import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // CREATE AREAS
  const area1 = await prisma.area.create({
    data: { name: 'Jawa Timur' },
  })
  const area2 = await prisma.area.create({
    data: { name: 'Jawa Tengah' },
  })

  // CREATE USERS
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: 'password123',
      name: 'System Admin',
      role: 'ADMIN',
    },
  })

  const spv = await prisma.user.create({
    data: {
      username: 'spv1',
      password: 'password123',
      name: 'Supervisor Jatim',
      role: 'SPV',
      areaId: area1.id,
    },
  })

  const afa = await prisma.user.create({
    data: {
      username: 'afa1',
      password: 'password123',
      name: 'AFA Jatim 1',
      role: 'AFA',
      areaId: area1.id,
    },
  })

  const fo1 = await prisma.user.create({
    data: {
      username: 'fo1',
      password: 'password123',
      name: 'FO Jatim 1A',
      role: 'FO',
      areaId: area1.id,
      afaId: afa.id,
    },
  })

  const fo2 = await prisma.user.create({
    data: {
      username: 'fo2',
      password: 'password123',
      name: 'FO Jatim 1B',
      role: 'FO',
      areaId: area1.id,
      afaId: afa.id,
    },
  })

  // CREATE PRODUCTS
  const p1 = await prisma.product.create({
    data: {
      name: 'Pupuk Cair Bintang',
      description: 'Pupuk cair daun untuk fase vegetatif',
      unit: 'ml',
    },
  })

  const p2 = await prisma.product.create({
    data: {
      name: 'Fungisida AntiJamur X',
      description: 'Obat jamur sistemik',
      unit: 'gr',
    },
  })

  const p3 = await prisma.product.create({
    data: {
      name: 'Insektisida EcoGuard',
      description: 'Insektisida ramah lingkungan',
      unit: 'ml',
    },
  })

  // Seed STOCK for AFA from Gudang
  await prisma.ledger.create({
    data: {
      userId: afa.id,
      productId: p1.id,
      transactionType: 'STOCK_IN_GUDANG',
      quantity: 5000,
      notes: 'Stok awal dari Gudang Pusat',
    },
  })

  await prisma.ledger.create({
    data: {
      userId: afa.id,
      productId: p2.id,
      transactionType: 'STOCK_IN_GUDANG',
      quantity: 3000,
      notes: 'Stok awal dari Gudang Pusat',
    },
  })

  await prisma.ledger.create({
    data: {
      userId: afa.id,
      productId: p3.id,
      transactionType: 'STOCK_IN_GUDANG',
      quantity: 2000,
      notes: 'Stok awal dari Gudang Pusat',
    },
  })

  // CREATE FARMERS
  await prisma.farmer.create({
    data: {
      name: 'Bpk. Suryono',
      phone: '08123456789',
      address: 'Desa Ngimbang',
      area: 'Kec. Ngimbang, Lamongan',
    },
  })

  await prisma.farmer.create({
    data: {
      name: 'Ibu Siti',
      phone: '08567891234',
      address: 'Desa Purwodadi',
      area: 'Kec. Purwodadi, Grobogan',
    },
  })

  console.log('Seeding finished.')
  console.log('=== Akun Login ===')
  console.log('Admin  : admin / password123')
  console.log('SPV    : spv1 / password123')
  console.log('AFA    : afa1 / password123')
  console.log('FO 1   : fo1 / password123')
  console.log('FO 2   : fo2 / password123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
