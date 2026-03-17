'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function createArea(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Nama area tidak boleh kosong.' }
  try {
    await prisma.area.create({ data: { name: name.trim() } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch (e) {
    return { error: 'Gagal menyimpan area.' }
  }
}

export async function deleteArea(id: string) {
  try {
    await prisma.area.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch (e) {
    return { error: 'Gagal menghapus area. Pastikan tidak ada user yang terkait.' }
  }
}

export async function createFarmer(formData: FormData) {
  const name    = formData.get('name')    as string
  const phone   = formData.get('phone')   as string
  const address = formData.get('address') as string
  const area    = formData.get('area')    as string
  if (!name?.trim()) return { error: 'Nama petani tidak boleh kosong.' }
  try {
    await prisma.farmer.create({ data: { name: name.trim(), phone: phone || null, address: address || null, area: area || null } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch (e) {
    return { error: 'Gagal menyimpan data petani.' }
  }
}

export async function deleteFarmer(id: string) {
  try {
    await prisma.farmer.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch (e) {
    return { error: 'Gagal menghapus petani. Pastikan tidak ada demo plot yang terkait.' }
  }
}
