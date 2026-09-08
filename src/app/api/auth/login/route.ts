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

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi!' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { area: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Username tidak ditemukan!' }, { status: 401 })
    }

    // Block deactivated accounts
    if (!user.isActive) {
      return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }, { status: 403 })
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
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

    const response = NextResponse.json({ success: true })
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    })

    return response
  } catch (err: any) {
    console.error('API Login error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server saat login.' }, { status: 500 })
  }
}
