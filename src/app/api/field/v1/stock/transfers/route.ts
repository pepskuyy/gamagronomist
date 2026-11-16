import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { formatLedgerQty } from '@/lib/stock-units'

export const dynamic = 'force-dynamic'

/**
 * Transfer stok antar AFA di mana user pengirim atau penerima, plus daftar calon penerima.
 * Sama dengan stockTransfer.findMany di dashboard/stock/page.tsx (hanya AFA/PLANTATION).
 */
export async function GET() {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  if (!['AFA', 'PLANTATION'].includes(user.role)) {
    return NextResponse.json({ error: 'Transfer stok hanya untuk AFA.' }, { status: 403 })
  }

  const [transfers, receivers] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        items: { select: { id: true, qtyRequested: true, qtyApproved: true, product: { select: { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ['AFA', 'PLANTATION'] }, id: { not: user.id } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    transfers: transfers.map(t => ({
      id: t.id,
      status: t.status,
      notes: t.notes,
      rejectReason: t.rejectReason,
      createdAt: t.createdAt,
      fromUser: t.fromUser,
      toUser: t.toUser,
      items: t.items.map(it => ({
        id: it.id,
        name: it.product.name,
        requested: formatLedgerQty(it.product, it.qtyRequested),
        approved: it.qtyApproved != null && it.qtyApproved !== it.qtyRequested ? formatLedgerQty(it.product, it.qtyApproved) : null,
      })),
    })),
    receivers,
  })
}
