import prisma from '@/lib/prisma'

/**
 * Builds a secure Prisma where clause for filtering Activity / KPI tables
 * (CustomerBehavior, VisitKios, FarmerGathering, VisitCompany)
 * based on RBAC and URL Search Parameters.
 */
export async function buildActivityWhereClause(session: any, searchParams: URLSearchParams, dateField: string = 'createdAt') {
  const whereClause: any = {}

  // 1. Enforce RBAC base
  // 1. Enforce RBAC base - DISABLED: All users can view global visualizations by default
  let allowedUserIds: string[] | null = null

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
  // User filter directly uses searchParam if present (no default override limitation)
  if (qUserId) {
    whereClause.userId = qUserId
  }

  // Area filter — gunakan snapshotAreaId (area saat aktivitas dibuat, berdasarkan GPS/coverage)
  if (qAreaId) {
    whereClause.snapshotAreaId = qAreaId
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
  // Base RBAC - DISABLED: All users can view global visualizations by default
  let allowedUserIds: string[] | null = null

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

  // User filter — melalui request
  if (qUserId) {
    whereClause.request = { foId: qUserId }
  }

  // Area filter — gunakan snapshotAreaId di DemoPlot (bukan via request.fo.areaId)
  if (qAreaId) {
    whereClause.snapshotAreaId = qAreaId
  }

  return whereClause
}
