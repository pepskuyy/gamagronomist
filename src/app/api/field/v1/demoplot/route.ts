import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'
import { demoplotScope, canContinue } from './scope'

export const dynamic = 'force-dynamic'

const TAKE = 20

/** Daftar pengajuan/realisasi demo plot user (tab Demo Plot laporan web). */
export async function GET(req: Request) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') || '1') || 1)

  const rows = await prisma.request.findMany({
    where: { commodity: { not: '-' }, farmer: { isNot: null }, ...(await demoplotScope(user)) },
    select: {
      id: true, createdAt: true, status: true, area: true, commodity: true, foId: true, afaId: true,
      fo: { select: { name: true } }, farmer: { select: { name: true } },
      demoPlots: { select: { isFinalSession: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * TAKE,
    take: TAKE + 1,
  })

  return NextResponse.json({
    items: rows.slice(0, TAKE).map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      farmerName: r.farmer?.name ?? '-',
      area: r.area,
      commodity: r.commodity,
      sessionCount: r.demoPlots.length,
      hasFinalSession: r.demoPlots.some(d => d.isFinalSession),
      canContinue: canContinue(r, user.id),
      by: r.foId === user.id ? null : r.fo.name,
    })),
    hasMore: rows.length > TAKE,
  })
}
