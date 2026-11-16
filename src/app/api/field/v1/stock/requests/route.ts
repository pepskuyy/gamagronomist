import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { FO_REQUEST_WHERE, requestInclude, serializeRequest } from './shared'

export const dynamic = 'force-dynamic'

const TAKE = 20

/**
 * Pengajuan stok milik user (FO/INTERN: ke AFA; AFA/PLANTATION/BD: ke gudang SPV), 20 per halaman.
 * AFA/PLANTATION juga menerima `pending`: pengajuan FO yang menunggu persetujuannya.
 * Where-clause mengikuti dashboard/stock/page.tsx.
 */
export async function GET(req: Request) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') || '1') || 1)
  const isAfa = ['AFA', 'PLANTATION'].includes(user.role)

  const mineWhere = ['FO', 'INTERN'].includes(user.role)
    ? { ...FO_REQUEST_WHERE, foId: user.id }
    : { commodity: 'AFA_STOCK_IN', foId: user.id }

  const [rows, pending] = await Promise.all([
    prisma.request.findMany({ where: mineWhere, include: requestInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * TAKE, take: TAKE + 1 }),
    isAfa && page === 1
      ? prisma.request.findMany({ where: { ...FO_REQUEST_WHERE, afaId: user.id, status: 'SUBMITTED' }, include: requestInclude, orderBy: { createdAt: 'asc' }, take: 50 })
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    items: rows.slice(0, TAKE).map(serializeRequest),
    hasMore: rows.length > TAKE,
    pending: pending.map(serializeRequest),
  })
}
