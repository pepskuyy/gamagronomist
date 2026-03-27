'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function setKpiTarget(data: {
  userId: string
  month: number
  year: number
  targetDemoPlot: number
  targetVisitKios: number
  targetGathering: number
  targetCompany: number
  targetBehavior: number
}) {
  try {
    const { userId, month, year, ...targets } = data
    await prisma.kpiTarget.upsert({
      where: { userId_month_year: { userId, month, year } },
      update: targets,
      create: { userId, month, year, ...targets },
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error setting KPI target:', error)
    return { success: false, error: 'Failed to update target' }
  }
}

/**
 * Get KPI data for a specific user (by their own userId + month).
 * targetUserId = the field user whose actuals to show
 * ownerUserId  = the SPV/AFA who owns the target record
 */
export async function getKpiData(
  ownerUserId: string,
  targetUserId: string,
  month: number,
  year: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)
  const dateFilter = { createdAt: { gte: startDate, lte: endDate } }

  // Actuals are counted for the targetUser AND any FOs under them
  const foRecords = await prisma.user.findMany({
    where: { afaId: targetUserId },
    select: { id: true }
  })
  const userIds = [targetUserId, ...foRecords.map(f => f.id)]

  const [demoPlots, visitKios, gatherings, companies, behaviors, target] = await Promise.all([
    prisma.demoPlot.count({ where: { ...dateFilter, request: { foId: { in: userIds } } } }),
    prisma.visitKios.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.farmerGathering.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.visitCompany.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.customerBehavior.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.kpiTarget.findUnique({
      where: { userId_month_year: { userId: targetUserId, month, year } }
    })
  ])

  return {
    targets: target ?? {
      targetDemoPlot: 0,
      targetVisitKios: 0,
      targetGathering: 0,
      targetCompany: 0,
      targetBehavior: 0
    },
    actuals: { demoPlot: demoPlots, visitKios, gathering: gatherings, company: companies, behavior: behaviors }
  }
}

/** Get all subordinate users visible to the SPV (AFA + FO) */
export async function getSubordinateUsers() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['AFA', 'FO', 'INTERN'] } },
    select: { id: true, username: true, name: true, role: true, afaId: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  })
  return users
}

/**
 * Get KPI data for an AFA or FO user.
 * The target is looked up from SPV accounts — we search all KpiTarget records
 * for any SPV whose target period matches, treating it as the team target.
 * For the AFA/FO view we show their PERSONAL actuals against the SPV-set target.
 */
export async function getKpiDataForFieldUser(
  userId: string,
  role: string,
  month: number,
  year: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0, 23, 59, 59)
  const dateFilter = { createdAt: { gte: startDate, lte: endDate } }

  // For FO: actuals are only this user's own activities
  // For AFA: actuals include their own + their FOs
  let userIds: string[] = [userId]
  if (role === 'AFA') {
    const fos = await prisma.user.findMany({ where: { afaId: userId }, select: { id: true } })
    userIds = [userId, ...fos.map(f => f.id)]
  }

  // Find the SPV target that covers this user.
  // Strategy: find an SPV who has a target for (month, year). 
  // If multiple SPVs, take the most recent one.
  const spvUsers = await prisma.user.findMany({
    where: { role: { in: ['SPV', 'ADMIN'] } },
    select: { id: true }
  })
  const spvIds = spvUsers.map(u => u.id)

  const [demoPlots, visitKios, gatherings, companies, behaviors, target] = await Promise.all([
    prisma.demoPlot.count({ where: { ...dateFilter, request: { foId: { in: userIds } } } }),
    prisma.visitKios.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.farmerGathering.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.visitCompany.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    prisma.customerBehavior.count({ where: { ...dateFilter, userId: { in: userIds } } }),
    // Look up the field user's own target first (set by SPV via dropdown),
    // then fall back to any SPV-wide target if none exists.
    prisma.kpiTarget.findFirst({
      where: { userId, month, year }
    }).then(async ownTarget => {
      if (ownTarget) return ownTarget
      return prisma.kpiTarget.findFirst({
        where: { userId: { in: spvIds }, month, year },
        orderBy: { updatedAt: 'desc' }
      })
    })
  ])

  return {
    hasTarget: !!target,
    targets: target ?? {
      targetDemoPlot: 0, targetVisitKios: 0,
      targetGathering: 0, targetCompany: 0, targetBehavior: 0
    },
    actuals: { demoPlot: demoPlots, visitKios, gathering: gatherings, company: companies, behavior: behaviors }
  }
}
