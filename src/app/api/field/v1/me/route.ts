import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFieldSession } from '@/lib/field-api'

export const dynamic = 'force-dynamic'

/** Profil user + pengaturan app. Dipanggil app saat start untuk memvalidasi token. */
export async function GET() {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { password: _pw, ...user } = auth.user
  // Diatur ADMIN lewat SystemConfig; kosong = tidak ada batas versi
  const min = await prisma.systemConfig.findUnique({ where: { key: 'field_min_app_version' }, select: { value: true } })
  return NextResponse.json({ user, minAppVersion: min?.value ?? null })
}
