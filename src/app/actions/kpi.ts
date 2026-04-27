'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// ── Types ──────────────────────────────────────────────────────────────────

export type Targets = {
  targetDemoPlot:  number
  targetVisitKios: number
  targetGathering: number
  targetCompany:   number
  targetBehavior:  number
}

export type UserContribution = {
  userId: string
  userName: string
  role: string
  count: number
}

export type AreaTargetData = {
  targets: Targets
  actuals: {
    demoPlot:  number
    visitKios: number
    gathering: number
    company:   number
    behavior:  number
  }
  contributions: {
    demoPlot:  UserContribution[]
    visitKios: UserContribution[]
    gathering: UserContribution[]
    company:   UserContribution[]
    behavior:  UserContribution[]
  }
}

const EMPTY_TARGETS: Targets = {
  targetDemoPlot: 0, targetVisitKios: 0,
  targetGathering: 0, targetCompany: 0, targetBehavior: 0,
}

// ── Set Target (SPV/ADMIN only, per area) ─────────────────────────────────

export async function setAreaTarget(data: {
  areaId: string | null   // null = "Tanpa Area"
  month: number
  year: number
} & Targets) {
  try {
    const { areaId, month, year, ...targets } = data
    console.log(`[KPI SET] Saving target: areaId=${areaId}, month=${month}, year=${year}`, targets)
    const result = await prisma.kpiTarget.upsert({
      where: { areaId_month_year: { areaId: areaId ?? null, month, year } },
      update: targets,
      create: { areaId: areaId ?? null, month, year, ...targets },
    })
    console.log(`[KPI SET] Saved record id=${result.id}, areaId=${result.areaId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error setting area target:', error)
    return { success: false, error: 'Gagal menyimpan target.' }
  }
}

// ── Get all areas (for dropdown) ──────────────────────────────────────────

export async function getAreas() {
  return prisma.area.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
}

// ── Core: get target + actuals + user contributions for one area ──────────

async function computeForArea(
  userIds: string[],
  month: number,
  year: number,
  areaId: string | null
): Promise<AreaTargetData> {
  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0, 23, 59, 59, 999)
  const df = { createdAt: { gte: startDate, lte: endDate } }

  // fetch target record for this area
  const target = await prisma.kpiTarget.findUnique({
    where: { areaId_month_year: { areaId: areaId ?? null, month, year } }
  })

  const targets: Targets = target
    ? { targetDemoPlot: target.targetDemoPlot, targetVisitKios: target.targetVisitKios,
        targetGathering: target.targetGathering, targetCompany: target.targetCompany, targetBehavior: target.targetBehavior }
    : { ...EMPTY_TARGETS }

  if (userIds.length === 0) {
    return {
      targets,
      actuals: { demoPlot: 0, visitKios: 0, gathering: 0, company: 0, behavior: 0 },
      contributions: { demoPlot: [], visitKios: [], gathering: [], company: [], behavior: [] }
    }
  }

  // fetch user info for contribution labels
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true }
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  // Per-user counts in parallel
  const [dpCounts, kiosCounts, gatherCounts, compCounts, cbCounts] = await Promise.all([
    // Demo plot: counted per foId on the request
    Promise.all(userIds.map(uid =>
      prisma.demoPlot.count({ where: { ...df, request: { foId: uid } } }).then(c => ({ uid, c }))
    )),
    Promise.all(userIds.map(uid =>
      prisma.visitKios.count({ where: { ...df, userId: uid } }).then(c => ({ uid, c }))
    )),
    Promise.all(userIds.map(uid =>
      prisma.farmerGathering.count({ where: { ...df, userId: uid } }).then(c => ({ uid, c }))
    )),
    Promise.all(userIds.map(uid =>
      prisma.visitCompany.count({ where: { ...df, userId: uid } }).then(c => ({ uid, c }))
    )),
    Promise.all(userIds.map(uid =>
      prisma.customerBehavior.count({ where: { ...df, userId: uid } }).then(c => ({ uid, c }))
    )),
  ])

  function toContrib(counts: { uid: string; c: number }[]): UserContribution[] {
    return counts
      .filter(x => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .map(x => ({
        userId: x.uid,
        userName: userMap.get(x.uid)?.name ?? x.uid,
        role: userMap.get(x.uid)?.role ?? '',
        count: x.c
      }))
  }

  const contribDP    = toContrib(dpCounts)
  const contribKios  = toContrib(kiosCounts)
  const contribGath  = toContrib(gatherCounts)
  const contribComp  = toContrib(compCounts)
  const contribCB    = toContrib(cbCounts)

  return {
    targets,
    actuals: {
      demoPlot:  contribDP.reduce((s, x) => s + x.count, 0),
      visitKios: contribKios.reduce((s, x) => s + x.count, 0),
      gathering: contribGath.reduce((s, x) => s + x.count, 0),
      company:   contribComp.reduce((s, x) => s + x.count, 0),
      behavior:  contribCB.reduce((s, x) => s + x.count, 0),
    },
    contributions: {
      demoPlot:  contribDP,
      visitKios: contribKios,
      gathering: contribGath,
      company:   contribComp,
      behavior:  contribCB,
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get target data for one area OR all areas combined.
 * areaId = null → aggregate all areas (including "Tanpa Area" users)
 * areaId = 'none' → only "Tanpa Area" users (no area assigned)
 * areaId = '<id>'  → specific area
 */
export async function getAreaTargetData(
  areaId: string | null,
  month: number,
  year: number
): Promise<AreaTargetData & { hasTarget: boolean }> {

  if (areaId === null) {
    // ALL areas combined
    const allUsers = await prisma.user.findMany({
      where: { role: { in: ['AFA', 'FO', 'INTERN'] }, isActive: true },
      select: { id: true }
    })
    const userIds = allUsers.map(u => u.id)

    // Use Prisma aggregate for reliable SUM across all KpiTarget records
    const agg = await prisma.kpiTarget.aggregate({
      where: { month, year },
      _sum: {
        targetDemoPlot: true,
        targetVisitKios: true,
        targetGathering: true,
        targetCompany: true,
        targetBehavior: true,
      },
      _count: true,
    })

    console.log(`[KPI] Semua Area aggregate for ${month}/${year}: count=${agg._count}`, agg._sum)

    // Also log individual records for debugging
    const allRecords = await prisma.kpiTarget.findMany({ where: { month, year }, select: { areaId: true, targetDemoPlot: true } })
    console.log(`[KPI] Individual records:`, JSON.stringify(allRecords))

    const sumTargets: Targets = {
      targetDemoPlot:  agg._sum.targetDemoPlot  ?? 0,
      targetVisitKios: agg._sum.targetVisitKios ?? 0,
      targetGathering: agg._sum.targetGathering ?? 0,
      targetCompany:   agg._sum.targetCompany   ?? 0,
      targetBehavior:  agg._sum.targetBehavior  ?? 0,
    }

    const data = await computeForArea(userIds, month, year, null)
    return { ...data, targets: sumTargets, hasTarget: agg._count > 0 }
  }

  // Specific area OR "Tanpa Area"
  const actualAreaId = areaId === 'none' ? null : areaId

  const users = await prisma.user.findMany({
    where: {
      role: { in: ['AFA', 'FO', 'INTERN'] },
      isActive: true,
      areaId: actualAreaId,
    },
    select: { id: true }
  })
  const userIds = users.map(u => u.id)

  const data = await computeForArea(userIds, month, year, actualAreaId)
  return { ...data, hasTarget: Object.values(data.targets).some(v => v > 0) }
}
