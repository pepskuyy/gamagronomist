import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting cleanup of imported data from March 24, 2026...')

  // The local time is UTC+7, so midnight March 24 local time is March 23 17:00:00 UTC
  // To be safe and capture everything imported "today", let's use >= 2026-03-23T17:00:00.000Z
  const cutoffDate = new Date('2026-03-23T17:00:00.000Z')

  console.log('Finding Customer Behaviors to delete...')
  const cbDelete = await prisma.customerBehavior.deleteMany({
    where: {
      createdAt: { gte: cutoffDate }
    }
  })
  console.log(`Deleted ${cbDelete.count} Customer Behavior records.`)

  console.log('Finding Demo Plots Request to delete...')
  // Deleting the Request will automatically cascade delete the DemoPlots IF the relation was onDelete: Cascade
  // Oh wait, DemoPlot -> Request is not explicitly cascading. Let me check the schema.
  // We'll delete DemoPlots first to be safe.
  const dpDelete = await prisma.demoPlot.deleteMany({
    where: {
      createdAt: { gte: cutoffDate }
    }
  })
  console.log(`Deleted ${dpDelete.count} Demo Plot records.`)

  console.log('Cleaning up orphaned Mock Requests for Demo Plots...')
  const reqDelete = await prisma.request.deleteMany({
    where: {
      plan: 'Migrated Standalone Demo Plot',
      createdAt: { gte: cutoffDate }
    }
  })
  console.log(`Deleted ${reqDelete.count} Request Mock records.`)

  // Note: we leave Farmers and Users alone as they are master data and generally harmless if kept.

  console.log('Cleanup completed successfully.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
