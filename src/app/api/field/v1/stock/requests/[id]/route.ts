import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { formatLedgerQty } from '@/lib/stock-units'
import { requestInclude, serializeRequest } from '../shared'

export const dynamic = 'force-dynamic'

/**
 * Detail satu pengajuan stok bila milik user (foId) atau ditujukan ke AFA ini (afaId).
 * Untuk AFA pada pengajuan FO yang masih SUBMITTED: canApprove + saldo AFA per produk.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  const request = await prisma.request.findUnique({ where: { id }, include: requestInclude })
  const isAfa = ['AFA', 'PLANTATION'].includes(user.role)
  if (!request || !(request.foId === user.id || (isAfa && request.afaId === user.id))) {
    return NextResponse.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 })
  }

  const data = serializeRequest(request)
  const canApprove = isAfa && request.afaId === user.id && request.status === 'SUBMITTED' && request.commodity !== 'AFA_STOCK_IN'
  let myStock: Record<string, string> = {}
  if (canApprove) {
    const productIds = request.details.map(d => d.productId)
    const sums = await prisma.ledger.groupBy({ by: ['productId'], where: { userId: user.id, productId: { in: productIds } }, _sum: { quantity: true } })
    const qty = new Map(sums.map(s => [s.productId, s._sum.quantity ?? 0]))
    myStock = Object.fromEntries(request.details.map(d => [d.productId, formatLedgerQty(d.product, Math.round((qty.get(d.productId) ?? 0) * 1e4) / 1e4)]))
  }

  return NextResponse.json({ ...data, canApprove, myStock })
}
