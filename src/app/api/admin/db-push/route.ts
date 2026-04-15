import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ONE-TIME USE: Add snapshotAreaId columns via raw SQL
// DELETE THIS FILE after use!
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== 'gamagronomist-dbpush-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tables = [
    'Request',
    'DemoPlot',
    'SpotDemplot',
    'CustomerBehavior',
    'VisitKios',
    'FarmerGathering',
    'VisitCompany',
    'Ledger',
  ]

  const results: Record<string, string> = {}

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "snapshotAreaId" TEXT`
      )
      results[table] = 'OK'
    } catch (err: any) {
      results[table] = `ERROR: ${err.message}`
    }
  }

  return NextResponse.json({ success: true, results })
}
