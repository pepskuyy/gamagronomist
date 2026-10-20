import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
    const activity = searchParams.get('activity') || 'all'

    const startDate = new Date(year, month - 1, 1)
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999)
    const df = { createdAt: { gte: startDate, lte: endDate } }

    const doAll = activity === 'all'

    // Semua query independen → dijalankan paralel (sebelumnya sequential).
    // Query aktivitas yang tidak diminta di-resolve ke [] (perilaku sama).
    const [areas, users, dps, kiosGrouped, gatheringGrouped, companyGrouped, behaviorGrouped] = await Promise.all([
      prisma.area.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({ select: { id: true, areaId: true } }),
      doAll || activity === 'demoPlot'
        ? prisma.demoPlot.findMany({
            where: { date: { gte: startDate, lte: endDate } },
            select: { request: { select: { foId: true } } }
          })
        : Promise.resolve([]),
      doAll || activity === 'visitKios'
        ? prisma.visitKios.groupBy({ by: ['userId'], where: df, _count: { id: true } })
        : Promise.resolve([]),
      doAll || activity === 'gathering'
        ? prisma.farmerGathering.groupBy({ by: ['userId'], where: df, _count: { id: true } })
        : Promise.resolve([]),
      doAll || activity === 'company'
        ? prisma.visitCompany.groupBy({ by: ['userId'], where: df, _count: { id: true } })
        : Promise.resolve([]),
      doAll || activity === 'behavior'
        ? prisma.customerBehavior.groupBy({ by: ['userId'], where: df, _count: { id: true } })
        : Promise.resolve([]),
    ])

    // 1. Prepare area buckets
    const areaMap = new Map<string, { id: string; name: string; score: number }>()
    for (const a of areas) areaMap.set(a.id, { id: a.id, name: a.name, score: 0 })
    areaMap.set('none', { id: 'none', name: 'Tanpa Area', score: 0 })

    // 2. Map user to area
    const userToArea = new Map<string, string>()
    for (const u of users) userToArea.set(u.id, u.areaId ?? 'none')

    const addScore = (userId: string | null | undefined, count: number) => {
      if (!userId) return
      const areaId = userToArea.get(userId) ?? 'none'
      const a = areaMap.get(areaId)
      if (a) a.score += count
    }

    // 3. Tally activity counts
    for (const dp of dps as { request: { foId: string | null } | null }[]) addScore(dp.request?.foId, 1)
    for (const grouped of [kiosGrouped, gatheringGrouped, companyGrouped, behaviorGrouped] as { userId: string | null; _count: { id: number } }[][]) {
      for (const g of grouped) addScore(g.userId, g._count.id)
    }

    // 4. Convert to array, sort, and rank
    const result = Array.from(areaMap.values())
      .filter(a => a.score > 0) // Only include areas with activities
      .sort((a, b) => b.score - a.score)
      .map((a, i) => ({ ...a, rank: i + 1 }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[leaderboard-area]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
