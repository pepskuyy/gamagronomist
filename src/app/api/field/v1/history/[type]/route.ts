import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'

export const dynamic = 'force-dynamic'

const TAKE = 20
type Row = { id: string; createdAt: Date; user: { name: string } } & Record<string, any>

// type → model Prisma + ringkasan baris untuk daftar riwayat di app
const TYPES: Record<string, { model: string; title: (r: Row) => string; subtitle: (r: Row) => string }> = {
  'customer-behavior': { model: 'customerBehavior', title: r => r.farmerName, subtitle: r => [r.commodity, r.district].filter(Boolean).join(' · ') },
  'visit-kios':        { model: 'visitKios',        title: r => r.kiosName, subtitle: r => r.visitResult ?? '' },
  'farmer-gathering':  { model: 'farmerGathering',  title: r => r.leaderName || 'Gathering', subtitle: r => r.district || r.address || '' },
  'visit-company':     { model: 'visitCompany',     title: r => r.companyName, subtitle: r => r.district ?? '' },
  'spot-demplot':      { model: 'spotDemplot',      title: r => r.districtDesa || r.districtKab || 'Spot Demplot', subtitle: r => r.observationResult ?? '' },
  'video-konten':      { model: 'contentVideo',     title: r => r.theme, subtitle: r => r.notes ?? '' },
}

/** Riwayat laporan milik user (AFA/PLANTATION: termasuk FO di bawahnya, sama seperti web). */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { type } = await params
  if (!Object.hasOwn(TYPES, type)) return NextResponse.json({ error: 'Jenis laporan tidak dikenal.' }, { status: 404 })
  const def = TYPES[type]
  const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') || '1') || 1)

  const { user } = auth
  let userIds = [user.id]
  if (['AFA', 'PLANTATION'].includes(user.role)) {
    const fos = await prisma.user.findMany({ where: { afaId: user.id }, select: { id: true } })
    userIds = [user.id, ...fos.map(f => f.id)]
  }

  const rows: Row[] = await (prisma as any)[def.model].findMany({
    where: { userId: { in: userIds } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * TAKE,
    take: TAKE + 1,
  })

  return NextResponse.json({
    items: rows.slice(0, TAKE).map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      title: def.title(r),
      subtitle: def.subtitle(r),
      by: r.userId === user.id ? null : r.user.name,
    })),
    hasMore: rows.length > TAKE,
  })
}
