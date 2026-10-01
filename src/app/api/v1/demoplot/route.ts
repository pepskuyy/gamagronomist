import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyOpenApiKey } from '@/lib/open-api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await verifyOpenApiKey(req)
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const from    = sp.get('from')
  const to      = sp.get('to')
  const sales   = sp.get('sales')   // filter by user name (contains)
  const area    = sp.get('area')    // filter by snapshotAreaId or area area name (contains)
  const status  = sp.get('status')  // e.g. SUBMITTED, APPROVED, DEMO_PLOT_SELESAI
  const limit   = Math.min(parseInt(sp.get('limit') || '50'), 200)
  const page    = Math.max(parseInt(sp.get('page') || '1'), 1)

  const where: Record<string, any> = {
    commodity: { not: '-' },
    farmer: { isNot: null },
  }

  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  if (status) where.status = status

  if (sales) {
    where.fo = { name: { contains: sales, mode: 'insensitive' } }
  }

  const [rows, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        fo: { select: { id: true, name: true, role: true } },
        farmer: { select: { id: true, name: true, phone: true, address: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } }
          }
        },
        demoPlots: {
          select: {
            id: true, date: true, area: true, commodity: true, cropAgeDays: true,
            landSize: true, landSizeUnit: true, resultNotes: true, latitude: true,
            longitude: true, isFinalSession: true, createdAt: true,
            details: {
              include: {
                product: { select: { id: true, name: true, code: true, unit: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.request.count({ where }),
  ])

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, hasMore: page * limit < total }
  })
}
