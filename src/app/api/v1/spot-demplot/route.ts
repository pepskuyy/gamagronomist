import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyOpenApiKey } from '@/lib/open-api-auth'
import { ledgerUnit } from '@/lib/stock-units'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await verifyOpenApiKey(req)
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const from  = sp.get('from')
  const to    = sp.get('to')
  const sales = sp.get('sales')  // filter by user name
  const desa  = sp.get('desa')
  const kecamatan = sp.get('kecamatan')
  const limit = Math.min(parseInt(sp.get('limit') || '50'), 200)
  const page  = Math.max(parseInt(sp.get('page') || '1'), 1)

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
  if (desa) where.districtDesa = { contains: desa, mode: 'insensitive' }
  if (kecamatan) where.districtKec = { contains: kecamatan, mode: 'insensitive' }

  const [rows, total] = await Promise.all([
    prisma.spotDemplot.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true, unitGramasi: true, gramasiPerUnit: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.spotDemplot.count({ where }),
  ])

  // usage_unit: satuan angka usage (ml/gr untuk produk bergramasi, selain itu kemasan).
  // product.unit tetap berarti satuan kemasan; jangan dipakai sebagai label usage.
  const data = rows.map(r => ({
    ...r,
    details: r.details.map(d => ({ ...d, usage_unit: ledgerUnit(d.product) })),
  }))

  return NextResponse.json({
    data,
    meta: { page, limit, total, hasMore: page * limit < total }
  })
}
