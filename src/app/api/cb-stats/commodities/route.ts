import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

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

    const cbs = await prisma.customerBehavior.findMany({
      where: whereClause,
      select: { commodity: true }
    })

    // Count commodities
    const tally: Record<string, number> = {}
    for (const cb of cbs) {
      const raw = cb.commodity || 'Tidak diketahui'
      const parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const p of parts) {
        // Ensure first letter capitalized for consistency
        const key = p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Tidak diketahui'
        tally[key] = (tally[key] || 0) + 1
      }
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(tally)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ total, items: sorted })
  } catch (err) {
    console.error('cb-stats-commodities error', err)
    return NextResponse.json({ total: 0, items: [] })
  }
}
