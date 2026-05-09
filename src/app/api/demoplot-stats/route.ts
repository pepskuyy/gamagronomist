import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Build role filter
    let whereClause: any = {}
    if (session.role === 'FO' || session.role === 'INTERN') {
      whereClause = { request: { foId: session.userId } }
    } else if (['AFA', 'PLANTATION'].includes(session.role)) {
      whereClause = { request: { OR: [{ afaId: session.userId }, { foId: session.userId }] } }
    }

    const demoPlots = await prisma.demoPlot.findMany({
      where: whereClause,
      select: { commodity: true, request: { select: { commodity: true } } }
    })

    // Count commodities
    const tally: Record<string, number> = {}
    for (const dp of demoPlots) {
      const raw = dp.commodity || dp.request?.commodity || 'Tidak diketahui'
      // A demo plot commodity can be comma-separated (multi)
      const parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const p of parts) {
        const key = p || 'Tidak diketahui'
        tally[key] = (tally[key] || 0) + 1
      }
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(tally)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ total, items: sorted })
  } catch (err) {
    console.error('commodity-stats error', err)
    return NextResponse.json({ total: 0, items: [] })
  }
}
