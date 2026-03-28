import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Builds a secure Prisma where clause for filtering Activity / KPI tables
 * (CustomerBehavior, VisitKios, FarmerGathering, VisitCompany)
 * based on RBAC and URL Search Parameters.
 */
export async function buildActivityWhereClause(session: any, searchParams: URLSearchParams, dateField: string = 'createdAt') {
  const whereClause: any = {}

  // 1. Enforce RBAC base
  let allowedUserIds: string[] | null = null
  if (session.role === 'FO' || session.role === 'INTERN') {
    allowedUserIds = [session.userId]
  } else if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({
      where: { afaId: session.userId },
      select: { id: true }
    })
    allowedUserIds = [session.userId, ...fos.map(f => f.id)]
  }

  // 2. Apply Custom Query Filters
  const qStart = searchParams.get('start')
  const qEnd = searchParams.get('end')
  const qUserId = searchParams.get('userId')
  const qAreaId = searchParams.get('areaId')

  if (qStart || qEnd) {
    whereClause[dateField] = {}
    if (qStart) whereClause[dateField].gte = new Date(`${qStart}T00:00:00.000Z`)
    if (qEnd) whereClause[dateField].lte = new Date(`${qEnd}T23:59:59.999Z`)
  }

  // User filter
  if (qUserId) {
    // Make sure SPV or AFA is explicitly filtering for an allowed subordinate
    if (allowedUserIds && !allowedUserIds.includes(qUserId)) {
      whereClause.userId = 'UNAUTHORIZED' // Forces 0 results securely
    } else {
      whereClause.userId = qUserId
    }
  } else if (allowedUserIds) {
    // General restricted view
    whereClause.userId = { in: allowedUserIds }
  }

  // Area filter
  if (qAreaId) {
    whereClause.user = { areaId: qAreaId }
  }

  return whereClause
}

/**
 * Builds a secure Prisma where clause for Demo Plots
 * taking into account relations (`request.foId`) and the same RBAC concepts.
 */
export async function buildDemoPlotWhereClause(session: any, searchParams: URLSearchParams) {
  const whereClause: any = {}
  
  // Base RBAC
  let allowedUserIds: string[] | null = null
  if (session.role === 'FO' || session.role === 'INTERN') {
    allowedUserIds = [session.userId]
  } else if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({
      where: { afaId: session.userId },
      select: { id: true }
    })
    allowedUserIds = [session.userId, ...fos.map(f => f.id)]
  }

  // Combine conditions
  const qStart = searchParams.get('start')
  const qEnd = searchParams.get('end')
  const qUserId = searchParams.get('userId')
  const qAreaId = searchParams.get('areaId')

  if (qStart || qEnd) {
    whereClause.date = {}
    if (qStart) whereClause.date.gte = new Date(`${qStart}T00:00:00.000Z`)
    if (qEnd) whereClause.date.lte = new Date(`${qEnd}T23:59:59.999Z`)
  }

  const requestFilter: any = {}

  if (qUserId) {
    if (allowedUserIds && !allowedUserIds.includes(qUserId)) {
      requestFilter.foId = 'UNAUTHORIZED'
    } else {
      requestFilter.foId = qUserId
    }
  } else if (allowedUserIds) {
    requestFilter.foId = { in: allowedUserIds }
  }

  if (qAreaId) {
    requestFilter.fo = { areaId: qAreaId }
  }

  if (Object.keys(requestFilter).length > 0) {
    whereClause.request = requestFilter
  }

  return whereClause
}
