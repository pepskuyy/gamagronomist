import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { formatLedgerQty } from '@/lib/stock-units'

export const dynamic = 'force-dynamic'

/** Saldo stok milik user, sudah diformat dengan aturan satuan yang sama dengan web. */
export async function GET() {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth

  const sums = await prisma.ledger.groupBy({ by: ['productId'], where: { userId: auth.user.id }, _sum: { quantity: true } })
  const rows = sums.map(s => ({ productId: s.productId, quantity: Math.round((s._sum.quantity ?? 0) * 1e4) / 1e4 })).filter(r => r.quantity !== 0)
  const products = await prisma.product.findMany({
    where: { id: { in: rows.map(r => r.productId) } },
    select: { id: true, name: true, code: true, unit: true, unitGramasi: true, gramasiPerUnit: true },
  })
  const byId = new Map(products.map(p => [p.id, p]))

  return NextResponse.json(
    rows
      .map(r => {
        const p = byId.get(r.productId)
        return { productId: r.productId, name: p?.name ?? '-', code: p?.code ?? null, quantity: r.quantity, display: formatLedgerQty(p, r.quantity) }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}
