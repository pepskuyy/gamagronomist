'use server'

import { cookies } from 'next/headers'
import { encrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function login(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan Password wajib diisi!' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { area: true }
    })

    if (!user) {
      return { error: 'Username tidak ditemukan!' }
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password)
    
    if (!isMatch) {
      return { error: 'Password salah!' }
    }

    // Create session
    const sessionToken = await encrypt({ 
      userId: user.id, 
      username: user.username,
      role: user.role,
      name: user.name,
      areaId: user.areaId,
      afaId: user.afaId
    })
    
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return { success: true }
  } catch (err) {
    console.error('Login error', err)
    return { error: 'Terjadi kesalahan pada server saat login.' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
