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

    // 1. Prepare area buckets
    const areas = await prisma.area.findMany({ select: { id: true, name: true } })
    const areaMap = new Map<string, { id: string; name: string; score: number }>()
    for (const a of areas) areaMap.set(a.id, { id: a.id, name: a.name, score: 0 })
    areaMap.set('none', { id: 'none', name: 'Tanpa Area', score: 0 })

    // 2. Map user to area
    const users = await prisma.user.findMany({ select: { id: true, areaId: true } })
    const userToArea = new Map<string, string>()
    for (const u of users) userToArea.set(u.id, u.areaId ?? 'none')

    const addScore = (userId: string | null | undefined, count: number) => {
      if (!userId) return
      const areaId = userToArea.get(userId) ?? 'none'
      const a = areaMap.get(areaId)
      if (a) a.score += count
    }

    // 3. Fetch activity counts
    const doAll = activity === 'all'

    if (doAll || activity === 'demoPlot') {
      const dps = await prisma.demoPlot.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        select: { request: { select: { foId: true } } }
      })
      for (const dp of dps) addScore(dp.request?.foId, 1)
    }
    
    if (doAll || activity === 'visitKios') {
      const grouped = await prisma.visitKios.groupBy({ by: ['userId'], where: df, _count: { id: true } })
      for (const g of grouped) addScore(g.userId, g._count.id)
    }

    if (doAll || activity === 'gathering') {
      const grouped = await prisma.farmerGathering.groupBy({ by: ['userId'], where: df, _count: { id: true } })
      for (const g of grouped) addScore(g.userId, g._count.id)
    }

    if (doAll || activity === 'company') {
      const grouped = await prisma.visitCompany.groupBy({ by: ['userId'], where: df, _count: { id: true } })
      for (const g of grouped) addScore(g.userId, g._count.id)
    }

    if (doAll || activity === 'behavior') {
      const grouped = await prisma.customerBehavior.groupBy({ by: ['userId'], where: df, _count: { id: true } })
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
