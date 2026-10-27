import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireApiSession } from '@/lib/session'
import {
  getRadiusSetting,
  saveRadiusSetting,
  parseRadius,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  RADIUS_EDIT_ROLES,
} from '@/lib/demoplot-radius'
import { clearImpactSummaryCache } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const setting = await getRadiusSetting()
  return NextResponse.json({
    ...setting,
    min_radius_km: MIN_RADIUS_KM,
    max_radius_km: MAX_RADIUS_KM,
    can_edit: RADIUS_EDIT_ROLES.includes(auth.role),
  })
}

export async function POST(req: Request) {
  const auth = await requireApiSession(RADIUS_EDIT_ROLES)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const radiusKm = parseRadius(body?.radius_km)
  if (radiusKm === null) {
    return NextResponse.json(
      { error: `Radius harus antara ${String(MIN_RADIUS_KM).replace('.', ',')} dan ${MAX_RADIUS_KM} km` },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } })
  const setting = await saveRadiusSetting(radiusKm, user?.name || auth.username || null)
  clearImpactSummaryCache()

  return NextResponse.json({
    ...setting,
    min_radius_km: MIN_RADIUS_KM,
    max_radius_km: MAX_RADIUS_KM,
    can_edit: true,
  })
}
