'use server'

import prisma from '@/lib/prisma'
import type { Targets } from './kpi'

export type TrendData = {
  monthLabel: string
  target: number
  actual: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function generatePeriods(fromMonth: number, fromYear: number, toMonth: number, toYear: number) {
  const periods: { m: number; y: number }[] = []
  let m = fromMonth
  let y = fromYear
  while (y < toYear || (y === toYear && m <= toMonth)) {
    periods.push({ m, y })
    m++
    if (m > 12) { m = 1; y++ }
    // safety cap: max 12
    if (periods.length >= 12) break
  }
  return periods
}

export async function getTargetTrendData(
  areaId: string | null,
  activityType: string,
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number,
): Promise<TrendData[]> {
  const periods = generatePeriods(fromMonth, fromYear, toMonth, toYear)
  if (periods.length === 0) return []

  // 1. Get user IDs for the area (once, reused for all periods)
  let userIds: string[] = []
  if (areaId === null) {
    const allUsers = await prisma.user.findMany({
      where: { role: { in: ['AFA', 'PLANTATION', 'FO', 'INTERN'] } },
      select: { id: true }
    })
    userIds = allUsers.map(u => u.id)
  } else {
    const actualAreaId = areaId === 'none' ? null : areaId
    const users = await prisma.user.findMany({
      where: { role: { in: ['AFA', 'PLANTATION', 'FO', 'INTERN'] }, areaId: actualAreaId },
      select: { id: true }
    })
    userIds = users.map(u => u.id)
  }

  // 2. Fetch targets and actuals for all periods concurrently
  const results = await Promise.all(
    periods.map(async (p) => {
      let targets: Targets = { targetDemoPlot: 0, targetVisitKios: 0, targetGathering: 0, targetCompany: 0, targetBehavior: 0 }

      if (areaId === null) {
        const agg = await prisma.kpiTarget.aggregate({
          where: { month: p.m, year: p.y },
          _sum: { targetDemoPlot: true, targetVisitKios: true, targetGathering: true, targetCompany: true, targetBehavior: true }
        })
        targets = {
          targetDemoPlot: agg._sum.targetDemoPlot ?? 0,
          targetVisitKios: agg._sum.targetVisitKios ?? 0,
          targetGathering: agg._sum.targetGathering ?? 0,
          targetCompany: agg._sum.targetCompany ?? 0,
          targetBehavior: agg._sum.targetBehavior ?? 0,
        }
      } else {
        const actualAreaId = areaId === 'none' ? null : areaId
        const target = await prisma.kpiTarget.findFirst({
          where: { areaId: actualAreaId, month: p.m, year: p.y }
        })
        if (target) {
          targets = {
            targetDemoPlot: target.targetDemoPlot,
            targetVisitKios: target.targetVisitKios,
            targetGathering: target.targetGathering,
            targetCompany: target.targetCompany,
            targetBehavior: target.targetBehavior
          }
        }
      }

      const startDate = new Date(p.y, p.m - 1, 1)
      const endDate   = new Date(p.y, p.m, 0, 23, 59, 59, 999)
      const df = { createdAt: { gte: startDate, lte: endDate } }

      let dpCount = 0, kiosCount = 0, gatherCount = 0, compCount = 0, cbCount = 0

      if (userIds.length > 0) {
        ;[dpCount, kiosCount, gatherCount, compCount, cbCount] = await Promise.all([
          prisma.demoPlot.count({ where: { date: { gte: startDate, lte: endDate }, request: { foId: { in: userIds } } } }),
          prisma.visitKios.count({ where: { ...df, userId: { in: userIds } } }),
          prisma.farmerGathering.count({ where: { ...df, userId: { in: userIds } } }),
          prisma.visitCompany.count({ where: { ...df, userId: { in: userIds } } }),
          prisma.customerBehavior.count({ where: { ...df, userId: { in: userIds } } }),
        ])
      }

      return {
        m: p.m, y: p.y,
        targets,
        actuals: { demoPlot: dpCount, visitKios: kiosCount, gathering: gatherCount, company: compCount, behavior: cbCount }
      }
    })
  )

  const targetMap: Record<string, keyof Targets> = {
    demoPlot: 'targetDemoPlot', visitKios: 'targetVisitKios',
    gathering: 'targetGathering', company: 'targetCompany', behavior: 'targetBehavior',
  }

  return results.map(data => {
    let target = 0
    let actual = 0
    if (activityType === 'all') {
      target = Object.values(data.targets).reduce((a, b) => a + b, 0)
      actual = Object.values(data.actuals).reduce((a, b) => a + b, 0)
    } else {
      target = data.targets[targetMap[activityType]] || 0
      actual = data.actuals[activityType as keyof typeof data.actuals] || 0
    }
    return { monthLabel: `${MONTHS[data.m - 1]} ${data.y}`, target, actual }
  })
}
