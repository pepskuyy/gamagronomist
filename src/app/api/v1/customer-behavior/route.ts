import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyOpenApiKey } from '@/lib/open-api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await verifyOpenApiKey(req)
  if (!auth.ok) return auth.response

  const sp        = req.nextUrl.searchParams
  const from      = sp.get('from')
  const to        = sp.get('to')
  const sales     = sp.get('sales')
  const commodity = sp.get('commodity')
  const district  = sp.get('district')
  const limit     = Math.min(parseInt(sp.get('limit') || '50'), 200)
  const page      = Math.max(parseInt(sp.get('page') || '1'), 1)

  const where: Record<string, any> = {}

  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  if (sales) where.user = { name: { contains: sales, mode: 'insensitive' } }
  if (commodity) where.commodity = { contains: commodity, mode: 'insensitive' }
  if (district) where.district = { contains: district, mode: 'insensitive' }

  const [rows, total] = await Promise.all([
    prisma.customerBehavior.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customerBehavior.count({ where }),
  ])

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, hasMore: page * limit < total }
  })
}
