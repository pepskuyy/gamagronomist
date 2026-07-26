'use server'

import { getAreaTargetData } from './kpi'

export type TrendData = {
  monthLabel: string
  target: number
  actual: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export async function getTargetTrendData(areaId: string | null, activityType: string): Promise<TrendData[]> {
  const trend: TrendData[] = []
  const now = new Date()
  let currentMonth = now.getMonth() + 1
  let currentYear = now.getFullYear()

  // Generate last 6 months (including current)
  const periods = []
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i
    let y = currentYear
    if (m <= 0) {
      m += 12
      y -= 1
    }
    periods.push({ m, y })
  }

  // Fetch data concurrently for all 6 months
  const results = await Promise.all(
    periods.map(p => getAreaTargetData(areaId, p.m, p.y))
  )

  for (let i = 0; i < periods.length; i++) {
    const { m, y } = periods[i]
    const data = results[i]
    
    let target = 0
    let actual = 0

    if (activityType === 'all') {
      target = Object.values(data.targets).reduce((a, b) => a + b, 0)
      actual = Object.values(data.actuals).reduce((a, b) => a + b, 0)
    } else {
      const targetMap: Record<string, keyof typeof data.targets> = {
        demoPlot: 'targetDemoPlot',
        visitKios: 'targetVisitKios',
        gathering: 'targetGathering',
        company: 'targetCompany',
        behavior: 'targetBehavior',
      }
      target = data.targets[targetMap[activityType]] || 0
      actual = data.actuals[activityType as keyof typeof data.actuals] || 0
    }

    trend.push({
      monthLabel: `${MONTHS[m - 1]} ${y}`,
      target,
      actual
    })
  }

  return trend
}
