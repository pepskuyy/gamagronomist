import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { ledgerUnit } from '@/lib/stock-units'
import { demoplotScope, canContinue } from '../scope'

export const dynamic = 'force-dynamic'

const productSelect = { select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } }

/** Detail demo plot seperti halaman web demoplot/detail/[id]; 404 bila di luar cakupan user. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  const r = await prisma.request.findFirst({
    where: { id, ...(await demoplotScope(user)) },
    include: {
      fo: { select: { name: true } },
      farmer: { select: { name: true } },
      details: { include: { product: productSelect } },
      demoPlots: { include: { details: { include: { product: productSelect } } }, orderBy: { date: 'asc' } },
    },
  })
  if (!r) return NextResponse.json({ error: 'Demo plot tidak ditemukan.' }, { status: 404 })

  const photos = (s: string | null) => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }

  return NextResponse.json({
    id: r.id,
    createdAt: r.createdAt,
    status: r.status,
    foName: r.fo.name,
    farmerName: r.farmer?.name ?? '-',
    area: r.area,
    commodity: r.commodity,
    problem: r.problem,
    plan: r.plan,
    canContinue: canContinue(r, user.id),
    products: r.details.map(d => ({
      productId: d.productId, name: d.product.name, unit: ledgerUnit(d.product),
      qtyRequested: d.qtyRequested, qtyApproved: d.qtyApproved,
    })),
    sessions: r.demoPlots.map(dp => ({
      id: dp.id,
      date: dp.date,
      cropAgeDays: dp.cropAgeDays,
      landSize: dp.landSize,
      landSizeUnit: dp.landSizeUnit,
      latitude: dp.latitude,
      longitude: dp.longitude,
      resultNotes: dp.resultNotes,
      isFinalSession: dp.isFinalSession,
      photos: photos(dp.photos),
      usages: dp.details.map(d => ({
        productId: d.productId, name: d.product.name, unit: ledgerUnit(d.product),
        actualUsage: d.actualUsage, usedFarmerProduct: d.usedFarmerProduct,
      })),
    })),
  })
}
