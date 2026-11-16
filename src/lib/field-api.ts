/**
 * Sesi untuk App Lapangan (APK). App mengirim `Authorization: Bearer <JWT login>`;
 * middleware menyalinnya menjadi cookie `session`, jadi server action lama membacanya apa adanya.
 * Di sini ditambah cek langsung ke DB: akun dinonaktifkan / password diganti dari dashboard
 * langsung menolak token lama (JWT sendiri berlaku 7 hari).
 */
import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, type Session } from '@/lib/session'

export const FIELD_ROLES = ['FO', 'INTERN', 'AFA', 'PLANTATION', 'BD']

/** Sidik jari hash password; berubah saat password diganti → token lama gugur. */
export function passwordVersion(passwordHash: string) {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 12)
}

function loadUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, name: true, role: true, photo: true, phone: true, email: true,
      isActive: true, password: true, areaId: true, afaId: true,
      area: { select: { name: true } }, afa: { select: { name: true } },
    },
  })
}
type FieldUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>

const deny = (status: number, error: string, code: string) => NextResponse.json({ error, code }, { status })

export async function requireFieldSession(): Promise<{ session: Session; user: FieldUser } | NextResponse> {
  const session = await getSession()
  if (!session) return deny(401, 'Sesi berakhir. Silakan login lagi.', 'UNAUTHENTICATED')
  const user = await loadUser(session.userId)
  if (!user || !user.isActive) return deny(401, 'Akun dinonaktifkan. Hubungi administrator.', 'DEACTIVATED')
  if (session.pv && session.pv !== passwordVersion(user.password)) {
    return deny(401, 'Password telah diganti. Silakan login lagi.', 'PASSWORD_CHANGED')
  }
  if (!FIELD_ROLES.includes(user.role)) return deny(403, 'App Lapangan hanya untuk tim lapangan.', 'NOT_FIELD_ROLE')
  return { session, user }
}
