import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyOpenApiKey } from '@/lib/open-api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/demoplot
 * Demo-plot-centric: setiap baris adalah satu sesi DemoPlot dengan koordinat GPS
 * (latitude, longitude) di level atas, lengkap dengan farmer, request, dan produk.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyOpenApiKey(req)
  if (!auth.ok) return auth.response

  const sp         = req.nextUrl.searchParams
  const from       = sp.get('from')
  const to         = sp.get('to')
  const sales      = sp.get('sales')      // filter by pelaksana (request.fo.name)
  const area       = sp.get('area')       // filter by area/desa (contains)
  const status     = sp.get('status')     // request status
  const hasCoords  = sp.get('has_coords') // "1" = hanya yang punya latitude & longitude
  const limit      = Math.min(parseInt(sp.get('limit') || '50'), 200)
  const page       = Math.max(parseInt(sp.get('page') || '1'), 1)

  const where: Record<string, any> = {}

  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.date.lte = toDate
    }
  }

  if (area) where.area = { contains: area, mode: 'insensitive' }

  if (hasCoords === '1') {
    where.latitude  = { not: null }
    where.longitude = { not: null }
  }

  const requestFilter: Record<string, any> = {}
  if (status) requestFilter.status = status
  if (sales) requestFilter.fo = { name: { contains: sales, mode: 'insensitive' } }
  if (Object.keys(requestFilter).length > 0) where.request = requestFilter

  const [rows, total] = await Promise.all([
    prisma.demoPlot.findMany({
      where,
      select: {
        id: true,
        date: true,
        area: true,
        snapshotAreaId: true,
        commodity: true,
        cropAgeDays: true,
        landSize: true,
        landSizeUnit: true,
        resultNotes: true,
        photos: true,
        latitude: true,
        longitude: true,
        isFinalSession: true,
        createdAt: true,
        updatedAt: true,
        farmer: { select: { id: true, name: true, phone: true, address: true } },
        request: {
          select: {
            id: true,
            status: true,
            commodity: true,
            problem: true,
            plan: true,
            createdAt: true,
            fo:  { select: { id: true, name: true, role: true } },
            afa: { select: { id: true, name: true } },
          }
        },
        details: {
          select: {
            id: true,
            actualUsage: true,
            usedFarmerProduct: true,
            product: { select: { id: true, name: true, code: true, unit: true } },
          }
        },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.demoPlot.count({ where }),
  ])

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, hasMore: page * limit < total }
  })
}
