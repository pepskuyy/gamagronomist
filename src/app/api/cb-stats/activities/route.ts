import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export async function GET(req: any) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Import helper
    const { buildActivityWhereClause } = await import('@/lib/kpi-filters')
    const searchParams = req.nextUrl.searchParams
    const whereClause = await buildActivityWhereClause(session, searchParams)

    // Run count queries in parallel
    const [
      countCB,
      countKios,
      countFarmer,
      countCompany,
      countDemplot,
      countVideo
    ] = await Promise.all([
      prisma.customerBehavior.count({ where: whereClause }),
      prisma.visitKios.count({ where: whereClause }),
      prisma.farmerGathering.count({ where: whereClause }),
      prisma.visitCompany.count({ where: whereClause }),
      prisma.spotDemplot.count({ where: whereClause }),
      prisma.contentVideo.count({ where: whereClause })
    ])

    const tally: Record<string, number> = {
      'Customer Behavior': countCB,
      'Kunjungan Kios': countKios,
      'Kunjungan Petani': countFarmer,
      'Kunjungan Perusahaan': countCompany,
      'Spot Demplot': countDemplot,
      'Content Video': countVideo
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(tally)
      .filter(([_, count]) => count > 0) // Hide zero counts if desired, or keep them. Let's keep them if they are top? No, filter out 0.
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ total, items: sorted })
  } catch (err) {
    console.error('cb-stats-activities error', err)
    return NextResponse.json({ total: 0, items: [] })
  }
}
