import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { encrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    let username = ''
    let password = ''

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null)
      username = body?.username?.trim() || ''
      password = body?.password || ''
    } else {
      const formData = await req.formData().catch(() => null)
      if (formData) {
        username = (formData.get('username') as string)?.trim() || ''
        password = (formData.get('password') as string) || ''
      }
    }

    console.log(`[Auth Login] Login request received for username: "${username}"`)

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi!' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { area: true }
    })

    if (!user) {
      console.warn(`[Auth Login] Username not found: "${username}"`)
      return NextResponse.json({ error: 'Username tidak ditemukan!' }, { status: 401 })
    }

    // Block deactivated accounts
    if (!user.isActive) {
      console.warn(`[Auth Login] Account deactivated: "${username}"`)
      return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }, { status: 403 })
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      console.warn(`[Auth Login] Invalid password for username: "${username}"`)
      return NextResponse.json({ error: 'Password salah!' }, { status: 401 })
    }

    // Create session token
    const sessionToken = await encrypt({
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      photo: user.photo,
      areaId: user.areaId,
      afaId: user.afaId,
      isActive: user.isActive
    })

    const proto = req.headers.get('x-forwarded-proto') || ''
    const isHttps = proto === 'https' || req.url.startsWith('https:')

    console.log(`[Auth Login] Login success for user: "${user.name}" (${user.role}), https: ${isHttps}`)

    const response = NextResponse.json({ success: true, name: user.name, role: user.role })
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    })

    return response
  } catch (err: any) {
    console.error('[Auth Login] Fatal error during login:', err)
    return NextResponse.json({ error: `Terjadi kesalahan pada server: ${err.message || 'Unknown error'}` }, { status: 500 })
  }
}
