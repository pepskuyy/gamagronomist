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

    // Block deactivated accounts
    if (!user.isActive) {
      return { error: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password)
    
    if (!isMatch) {
      return { error: 'Password salah!' }
    }

    // Create session (include isActive so middleware can reject if later deactivated)
    const sessionToken = await encrypt({ 
      userId: user.id, 
      username: user.username,
      role: user.role,
      name: user.name,
      areaId: user.areaId,
      afaId: user.afaId,
      isActive: user.isActive
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

export async function changePassword(formData: FormData) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await import('@/lib/auth').then(m => m.decrypt(token as string))
    if (!session?.userId) return { error: 'Tidak terotorisasi.' }

    const currentPassword = formData.get('currentPassword') as string
    const newPassword     = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!currentPassword || !newPassword || !confirmPassword)
      return { error: 'Semua kolom wajib diisi.' }
    if (newPassword.length < 6)
      return { error: 'Password baru minimal 6 karakter.' }
    if (newPassword !== confirmPassword)
      return { error: 'Konfirmasi password tidak cocok.' }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) return { error: 'User tidak ditemukan.' }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) return { error: 'Password lama salah.' }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

    return { success: true }
  } catch (err) {
    console.error('Change password error', err)
    return { error: 'Terjadi kesalahan. Coba lagi.' }
  }
}

/**
 * Update email for the currently logged-in user (for password recovery)
 */
export async function updateEmail(formData: FormData) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await import('@/lib/auth').then(m => m.decrypt(token as string))
    if (!session?.userId) return { error: 'Tidak terotorisasi.' }

    const email = (formData.get('email') as string)?.trim()
    if (!email) return { error: 'Email wajib diisi.' }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return { error: 'Format email tidak valid.' }

    await prisma.user.update({
      where: { id: session.userId },
      data: { email }
    })

    return { success: true }
  } catch (err) {
    console.error('Update email error', err)
    return { error: 'Terjadi kesalahan. Coba lagi.' }
  }
}

/**
 * Reset password using username + email verification (no email sending needed)
 */
export async function resetPasswordWithEmail(formData: FormData) {
  try {
    const username = (formData.get('username') as string)?.trim()
    const email    = (formData.get('email') as string)?.trim()
    const newPassword     = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!username || !email) return { error: 'Username dan email wajib diisi.' }
    if (!newPassword || !confirmPassword) return { error: 'Password baru wajib diisi.' }
    if (newPassword.length < 6) return { error: 'Password baru minimal 6 karakter.' }
    if (newPassword !== confirmPassword) return { error: 'Konfirmasi password tidak cocok.' }

    const user = await prisma.user.findUnique({ where: { username } })

    if (!user) return { error: 'Username tidak ditemukan.' }
    if (!user.email) return { error: 'Akun ini belum mendaftarkan email. Hubungi admin untuk reset password.' }
    if (user.email.toLowerCase() !== email.toLowerCase()) return { error: 'Email tidak sesuai dengan yang terdaftar pada akun ini.' }
    if (!user.isActive) return { error: 'Akun ini telah dinonaktifkan.' }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed }
    })

    return { success: true }
  } catch (err) {
    console.error('Reset password error', err)
    return { error: 'Terjadi kesalahan. Coba lagi.' }
  }
}
