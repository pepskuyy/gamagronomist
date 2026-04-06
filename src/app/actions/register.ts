'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Submit a new account registration request
export async function submitAccountRequest(formData: FormData) {
  const username = (formData.get('username') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string)?.trim()
  const confirm  = (formData.get('confirm')  as string)?.trim()
  const name     = (formData.get('name')     as string)?.trim()
  const role     = formData.get('role') as string
  const areaName = (formData.get('areaName') as string)?.trim() || null
  const afaName  = (formData.get('afaName')  as string)?.trim() || null
  const notes    = (formData.get('notes')    as string)?.trim() || null
  const email    = (formData.get('email')    as string)?.trim() || null

  if (!username || !password || !name || !role) {
    return { error: 'Username, password, nama, dan role wajib diisi.' }
  }
  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' }
  }
  if (password !== confirm) {
    return { error: 'Password dan konfirmasi password tidak cocok.' }
  }
  if (!['AFA', 'FO', 'INTERN'].includes(role)) {
    return { error: 'Role tidak valid. Pilih AFA atau FO.' }
  }

  try {
    // Check username not taken in User table
    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) return { error: 'Username sudah digunakan. Pilih username lain.' }

    // Check not already requested
    const existingReq = await prisma.accountRequest.findUnique({ where: { username } })
    if (existingReq && existingReq.status === 'PENDING') {
      return { error: 'Username ini sudah memiliki permintaan pembuatan akun yang sedang menunggu persetujuan.' }
    }

    const hashed = await bcrypt.hash(password, 10)
    await prisma.accountRequest.upsert({
      where: { username },
      create: { username, password: hashed, name, role, email, areaName, afaName, notes, status: 'PENDING' },
      update: { password: hashed, name, role, email, areaName, afaName, notes, status: 'PENDING' },
    })
    return { success: true }
  } catch (e: any) {
    return { error: 'Gagal mengirim permintaan. Coba lagi.' }
  }
}

// SPV: Approve a request → create real User
export async function approveAccountRequest(requestId: string) {
  try {
    const req = await prisma.accountRequest.findUnique({ where: { id: requestId } })
    if (!req) return { error: 'Permintaan tidak ditemukan.' }

    // Find area by name if provided
    let areaId: string | null = null
    if (req.areaName) {
      const area = await prisma.area.findFirst({ where: { name: { contains: req.areaName, mode: 'insensitive' } } })
      areaId = area?.id ?? null
    }

    // Find AFA by name if provided (for FO role)
    let afaId: string | null = null
    if ((req.role === 'FO' || req.role === 'INTERN') && req.afaName) {
      const afa = await prisma.user.findFirst({ where: { role: 'AFA', name: { contains: req.afaName, mode: 'insensitive' } } })
      afaId = afa?.id ?? null
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          username: req.username,
          password: req.password,
          name: req.name,
          email: req.email,
          role: req.role,
          areaId,
          afaId,
        },
      }),
      prisma.accountRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      }),
    ])

    revalidatePath('/dashboard/master/requests')
    return { success: true }
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'Username sudah digunakan oleh akun lain.' }
    return { error: 'Gagal menyetujui permintaan.' }
  }
}

// SPV: Reject a request
export async function rejectAccountRequest(requestId: string, reason: string) {
  try {
    await prisma.accountRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', rejectReason: reason || 'Tidak memenuhi kriteria.' },
    })
    revalidatePath('/dashboard/master/requests')
    return { success: true }
  } catch {
    return { error: 'Gagal menolak permintaan.' }
  }
}
