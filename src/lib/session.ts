import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/auth'

export type Session = {
  userId: string
  username?: string
  role: string
  areaId?: string | null
  isActive?: boolean
  [key: string]: unknown
}

/**
 * Baca sesi login dari cookie. Mengembalikan null jika tidak login,
 * token tidak valid, atau akun dinonaktifkan.
 * Bisa dipakai di Server Action, Route Handler, dan Server Component.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get('session')?.value
  if (!token) return null
  const session = await decrypt(token)
  if (!session?.userId || session.isActive === false) return null
  return session as Session
}

/**
 * Untuk Route Handler: kembalikan sesi, atau NextResponse 401/403 jika ditolak.
 *
 *   const auth = await requireApiSession(['ADMIN', 'SPV'])
 *   if (auth instanceof NextResponse) return auth
 */
export async function requireApiSession(roles?: string[]): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (roles && !roles.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

/**
 * Untuk Server Action: kembalikan sesi, atau null jika tidak login / role tidak diizinkan.
 * Server Action bisa dipanggil langsung tanpa melewati UI, jadi setiap action wajib memanggil ini.
 */
export async function getActionSession(roles?: string[]): Promise<Session | null> {
  const session = await getSession()
  if (!session) return null
  if (roles && !roles.includes(session.role)) return null
  return session
}
