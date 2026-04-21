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
  const photo    = (formData.get('photo')    as string) || null

  if (!username || !name || !password || !role) return { error: 'Semua field wajib diisi.' }
  try {
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({ data: { username, name, password: hashed, role, areaId: areaId || null, afaId: afaId || null, photo } })
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
  const isActiveRaw = formData.get('isActive') as string
  const photo    = (formData.get('photo')    as string) || undefined

  if (!name || !role) return { error: 'Nama dan role wajib diisi.' }
  try {
    const data: any = { name, role, areaId: areaId || null, afaId: afaId || null }
    if (password) data.password = await bcrypt.hash(password, 10)
    if (isActiveRaw !== null && isActiveRaw !== undefined) data.isActive = isActiveRaw === 'true'
    if (photo !== undefined) data.photo = photo || null // Handle empty string as null
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
  const code          = (formData.get('code')          as string)?.trim()
  const name          = (formData.get('name')          as string)?.trim()
  const description   = (formData.get('description')   as string)?.trim()
  const unit          = (formData.get('unit')          as string)?.trim()
  const unitGramasi   = (formData.get('unitGramasi')   as string)?.trim() || null
  const gramasiRaw    = (formData.get('gramasiPerUnit') as string)?.trim()
  const gramasiPerUnit = gramasiRaw ? parseFloat(gramasiRaw) : null
  if (!name || !unit) return { error: 'Nama dan satuan kemasan wajib diisi.' }
  try {
    await prisma.product.create({ data: { 
      code: code || null, name, description: description || null, unit,
      unitGramasi: unitGramasi || null,
      gramasiPerUnit: gramasiPerUnit && !isNaN(gramasiPerUnit) ? gramasiPerUnit : null,
    }})
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan produk.' } }
}

export async function updateProduct(id: string, formData: FormData) {
  const code          = (formData.get('code')          as string)?.trim()
  const name          = (formData.get('name')          as string)?.trim()
  const description   = (formData.get('description')   as string)?.trim()
  const unit          = (formData.get('unit')          as string)?.trim()
  const unitGramasi   = (formData.get('unitGramasi')   as string)?.trim() || null
  const gramasiRaw    = (formData.get('gramasiPerUnit') as string)?.trim()
  const gramasiPerUnit = gramasiRaw ? parseFloat(gramasiRaw) : null
  if (!name || !unit) return { error: 'Nama dan satuan kemasan wajib diisi.' }
  try {
    await prisma.product.update({ where: { id }, data: { 
      code: code || null, name, description: description || null, unit,
      unitGramasi: unitGramasi || null,
      gramasiPerUnit: gramasiPerUnit && !isNaN(gramasiPerUnit) ? gramasiPerUnit : null,
    }})
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

// ─── BULK DELETE ─────────────────────────────────
export async function bulkDeleteAreas(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.area.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus area. Pastikan tidak ada user yang terkait.' } }
}

export async function bulkDeleteFarmers(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.farmer.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus petani.' } }
}

export async function bulkDeleteUsers(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch { return { error: 'Gagal menghapus users. Mungkin ada data yang terkait.' } }
}

export async function bulkDeleteProducts(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    // Must delete all related records first (no CASCADE configured in schema)
    await prisma.$transaction([
      // 1. Delete ledger entries (stock transactions)
      prisma.ledger.deleteMany({ where: { productId: { in: ids } } }),
      // 2. Delete demo plot detail (actual usage)
      prisma.demoPlotDetail.deleteMany({ where: { productId: { in: ids } } }),
      // 3. Delete request detail (requested items)
      prisma.requestDetail.deleteMany({ where: { productId: { in: ids } } }),
      // 4. Delete opname detail (stock opname lines)
      prisma.opnameDetail.deleteMany({ where: { productId: { in: ids } } }),
      // 5. Finally delete the products themselves
      prisma.product.deleteMany({ where: { id: { in: ids } } }),
    ])
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch (e: any) {
    console.error('Bulk delete products error:', e)
    return { error: 'Gagal menghapus produk: ' + (e?.message ?? 'Terjadi kesalahan.') }
  }
}

// ─── STORE (TOKO / PELANGGAN) ────────────────────────────────────
export async function createStore(formData: FormData) {
  const name      = (formData.get('name')      as string)?.trim()
  const code      = (formData.get('code')      as string)?.trim() || null
  const address   = (formData.get('address')   as string)?.trim() || null
  const phone     = (formData.get('phone')     as string)?.trim() || null
  const notes     = (formData.get('notes')     as string)?.trim() || null
  const latRaw    = (formData.get('latitude')  as string)?.trim()
  const lngRaw    = (formData.get('longitude') as string)?.trim()
  const latitude  = latRaw  ? parseFloat(latRaw)  : null
  const longitude = lngRaw  ? parseFloat(lngRaw)  : null

  if (!name) return { error: 'Nama toko tidak boleh kosong.' }
  try {
    await prisma.store.create({ data: {
      name, code, address, phone, notes,
      latitude:  latitude  && !isNaN(latitude)  ? latitude  : null,
      longitude: longitude && !isNaN(longitude) ? longitude : null,
    }})
    revalidatePath('/dashboard/master/stores')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan data toko.' } }
}

export async function updateStore(id: string, formData: FormData) {
  const name      = (formData.get('name')      as string)?.trim()
  const code      = (formData.get('code')      as string)?.trim() || null
  const address   = (formData.get('address')   as string)?.trim() || null
  const phone     = (formData.get('phone')     as string)?.trim() || null
  const notes     = (formData.get('notes')     as string)?.trim() || null
  const latRaw    = (formData.get('latitude')  as string)?.trim()
  const lngRaw    = (formData.get('longitude') as string)?.trim()
  const latitude  = latRaw  ? parseFloat(latRaw)  : null
  const longitude = lngRaw  ? parseFloat(lngRaw)  : null

  if (!name) return { error: 'Nama toko tidak boleh kosong.' }
  try {
    await prisma.store.update({ where: { id }, data: {
      name, code, address, phone, notes,
      latitude:  latitude  && !isNaN(latitude)  ? latitude  : null,
      longitude: longitude && !isNaN(longitude) ? longitude : null,
    }})
    revalidatePath('/dashboard/master/stores')
    return { success: true }
  } catch { return { error: 'Gagal mengupdate data toko.' } }
}

export async function deleteStore(id: string) {
  try {
    await prisma.store.delete({ where: { id } })
    revalidatePath('/dashboard/master/stores')
    return { success: true }
  } catch { return { error: 'Gagal menghapus toko.' } }
}

export async function bulkDeleteStores(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.store.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/stores')
    return { success: true }
  } catch { return { error: 'Gagal menghapus toko.' } }
}

