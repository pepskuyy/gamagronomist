'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── AREA ──────────────────────────────────────
export async function createArea(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Nama area tidak boleh kosong.' }
  try {
    await prisma.area.create({ data: { name: name.trim() } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan area.' } }
}

export async function deleteArea(id: string) {
  try {
    await prisma.area.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus area. Pastikan tidak ada user yang terkait.' } }
}

// ─── FARMER ────────────────────────────────────
export async function createFarmer(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Nama petani tidak boleh kosong.' }
  try {
    await prisma.farmer.create({ data: {
      name: name.trim(),
      phone:   (formData.get('phone')   as string) || null,
      address: (formData.get('address') as string) || null,
      area:    (formData.get('area')    as string) || null,
    }})
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan data petani.' } }
}

export async function deleteFarmer(id: string) {
  try {
    await prisma.farmer.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus petani.' } }
}

// ─── USER ───────────────────────────────────────
export async function createUser(formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const name     = (formData.get('name')     as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const role     = formData.get('role')     as string
  const areaId   = (formData.get('areaId')   as string) || null
  const afaId    = (formData.get('afaId')    as string) || null

  if (!username || !name || !password || !role) return { error: 'Semua field wajib diisi.' }
  try {
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({ data: { username, name, password: hashed, role, areaId: areaId || null, afaId: afaId || null } })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'Username sudah digunakan.' }
    return { error: 'Gagal menyimpan user.' }
  }
}

export async function updateUser(id: string, formData: FormData) {
  const name     = (formData.get('name')     as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const role     = formData.get('role')     as string
  const areaId   = (formData.get('areaId')   as string) || null
  const afaId    = (formData.get('afaId')    as string) || null

  if (!name || !role) return { error: 'Nama dan role wajib diisi.' }
  try {
    const data: any = { name, role, areaId: areaId || null, afaId: afaId || null }
    if (password) data.password = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id }, data })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch { return { error: 'Gagal mengupdate user.' } }
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch { return { error: 'Gagal menghapus user. Mungkin ada data yang terkait.' } }
}

// ─── PRODUCT ────────────────────────────────────
export async function createProduct(formData: FormData) {
  const code        = (formData.get('code')        as string)?.trim()
  const name        = (formData.get('name')        as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const unit        = (formData.get('unit')        as string)?.trim()
  if (!name || !unit) return { error: 'Nama dan satuan unit wajib diisi.' }
  try {
    await prisma.product.create({ data: { code: code || null, name, description: description || null, unit } })
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan produk.' } }
}

export async function updateProduct(id: string, formData: FormData) {
  const code        = (formData.get('code')        as string)?.trim()
  const name        = (formData.get('name')        as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const unit        = (formData.get('unit')        as string)?.trim()
  if (!name || !unit) return { error: 'Nama dan satuan unit wajib diisi.' }
  try {
    await prisma.product.update({ where: { id }, data: { code: code || null, name, description: description || null, unit } })
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch { return { error: 'Gagal mengupdate produk.' } }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } })
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch { return { error: 'Gagal menghapus produk. Mungkin ada stok atau request yang terkait.' } }
}

