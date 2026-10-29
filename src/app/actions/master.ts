'use server'

import prisma from '@/lib/prisma'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { getActionSession } from '@/lib/session'
import { invalidateCacheTag, CACHE_TAGS } from '@/lib/data-cache'
import { validateGramasiPair, hasGramasi, ledgerUnit } from '@/lib/stock-units'

// Master Data hanya untuk ADMIN & SPV (sesuai menu sidebar).
// Hanya ADMIN yang boleh membuat, mengubah, atau menghapus akun ADMIN.
const MASTER_ROLES = ['ADMIN', 'SPV']
// Pesan dikembalikan sebagai object literal langsung di `return` agar TypeScript
// menormalkan union hasil action menjadi { error?, success? } di sisi pemanggil.
const FORBIDDEN = 'Akses ditolak.'
const ADMIN_ONLY = 'Hanya ADMIN yang dapat mengelola akun ADMIN.'

const requireMaster = () => getActionSession(MASTER_ROLES)


// ─── AREA ──────────────────────────────────────
export async function createArea(formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Nama area tidak boleh kosong.' }
  try {
    await prisma.area.create({ data: { name: name.trim() } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menyimpan area.' } }
}

export async function deleteArea(id: string) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  try {
    await prisma.area.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus area. Pastikan tidak ada user yang terkait.' } }
}

// ─── FARMER ────────────────────────────────────
export async function createFarmer(formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
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
  if (!(await requireMaster())) return { error: FORBIDDEN }
  try {
    await prisma.farmer.delete({ where: { id } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus petani.' } }
}

// ─── USER ───────────────────────────────────────
export async function createUser(formData: FormData) {
  const session = await requireMaster()
  if (!session) return { error: FORBIDDEN }
  const username = (formData.get('username') as string)?.trim()
  const name     = (formData.get('name')     as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const role     = formData.get('role')     as string
  const areaId   = (formData.get('areaId')   as string) || null
  const afaId    = (formData.get('afaId')    as string) || null
  const photo    = (formData.get('photo')    as string) || null

  if (!username || !name || !password || !role) return { error: 'Semua field wajib diisi.' }
  if (role === 'ADMIN' && session.role !== 'ADMIN') return { error: ADMIN_ONLY }
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
  const session = await requireMaster()
  if (!session) return { error: FORBIDDEN }
  const name     = (formData.get('name')     as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const role     = formData.get('role')     as string
  const areaId   = (formData.get('areaId')   as string) || null
  const afaId    = (formData.get('afaId')    as string) || null
  const isActiveRaw = formData.get('isActive') as string
  const photo    = (formData.get('photo')    as string) || undefined

  if (!name || !role) return { error: 'Nama dan role wajib diisi.' }
  if (session.role !== 'ADMIN') {
    if (role === 'ADMIN') return { error: ADMIN_ONLY }
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === 'ADMIN') return { error: ADMIN_ONLY }
  }
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
  const session = await requireMaster()
  if (!session) return { error: FORBIDDEN }
  if (session.role !== 'ADMIN') {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === 'ADMIN') return { error: ADMIN_ONLY }
  }
  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch { return { error: 'Gagal menghapus user. Mungkin ada data yang terkait.' } }
}

// ─── PRODUCT ────────────────────────────────────
export async function createProduct(formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  const code          = (formData.get('code')          as string)?.trim()
  const name          = (formData.get('name')          as string)?.trim()
  const description   = (formData.get('description')   as string)?.trim()
  const unit          = (formData.get('unit')          as string)?.trim()
  const unitGramasi   = (formData.get('unitGramasi')   as string)?.trim() || null
  const gramasiRaw    = (formData.get('gramasiPerUnit') as string)?.trim()
  const gramasiPerUnit = gramasiRaw ? parseFloat(gramasiRaw) : null
  if (!name || !unit) return { error: 'Nama dan satuan kemasan wajib diisi.' }
  const pairError = validateGramasiPair(unitGramasi, gramasiPerUnit)
  if (pairError) return { error: pairError }
  try {
    await prisma.product.create({ data: {
      code: code || null, name, description: description || null, unit,
      unitGramasi: unitGramasi || null,
      gramasiPerUnit: gramasiPerUnit && !isNaN(gramasiPerUnit) ? gramasiPerUnit : null,
    }})
    revalidatePath('/dashboard/master/products')
    invalidateCacheTag(CACHE_TAGS.products)
    return { success: true }
  } catch { return { error: 'Gagal menyimpan produk.' } }
}

export async function updateProduct(id: string, formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  const code          = (formData.get('code')          as string)?.trim()
  const name          = (formData.get('name')          as string)?.trim()
  const description   = (formData.get('description')   as string)?.trim()
  const unit          = (formData.get('unit')          as string)?.trim()
  const unitGramasi   = (formData.get('unitGramasi')   as string)?.trim() || null
  const gramasiRaw    = (formData.get('gramasiPerUnit') as string)?.trim()
  const gramasiPerUnit = gramasiRaw ? parseFloat(gramasiRaw) : null
  if (!name || !unit) return { error: 'Nama dan satuan kemasan wajib diisi.' }
  const newGramasi = gramasiPerUnit && !isNaN(gramasiPerUnit) ? gramasiPerUnit : null
  const pairError = validateGramasiPair(unitGramasi, gramasiPerUnit)
  if (pairError) return { error: pairError }
  const confirmed = formData.get('confirmGramasiChange') === 'true'
  try {
    // Satuan ledger produk ditentukan oleh pasangan gramasi. Bila faktornya berubah
    // (mis. kosong → 500 ml/Btl, atau 500 → 1000), saldo setiap user dikonversi otomatis
    // lewat baris UNIT_CONVERSION supaya angka lama tidak terbaca dengan satuan baru.
    const current = await prisma.product.findUnique({ where: { id }, select: { gramasiPerUnit: true, unitGramasi: true, unit: true } })
    if (!current) return { error: 'Produk tidak ditemukan.' }
    const oldFactor = hasGramasi(current) ? current.gramasiPerUnit! : null
    const newFactor = hasGramasi({ unit, unitGramasi, gramasiPerUnit: newGramasi }) ? newGramasi! : null
    const oldUnitLabel = ledgerUnit(current)
    const newUnitLabel = newFactor ? (unitGramasi as string) : unit

    let holders: Array<{ userId: string; balance: number; converted: number }> = []
    if (oldFactor !== newFactor) {
      const balances = await prisma.ledger.groupBy({
        by: ['userId'],
        where: { productId: id },
        _sum: { quantity: true },
      })
      holders = balances
        .map(b => {
          const balance = b._sum.quantity || 0
          const kemasan = oldFactor ? balance / oldFactor : balance
          const converted = Math.round((newFactor ? kemasan * newFactor : kemasan) * 10000) / 10000
          return { userId: b.userId, balance, converted }
        })
        .filter(h => Math.abs(h.balance) > 0.0001)

      if (holders.length > 0 && !confirmed) {
        const users = await prisma.user.findMany({
          where: { id: { in: holders.map(h => h.userId) } },
          select: { id: true, name: true },
        })
        const nameMap = new Map(users.map(u => [u.id, u.name]))
        const lines = holders
          .slice(0, 15)
          .map(h => `• ${nameMap.get(h.userId) ?? h.userId}: ${h.balance} ${oldUnitLabel} → ${h.converted} ${newUnitLabel}`)
        if (holders.length > 15) lines.push(`• ... dan ${holders.length - 15} user lainnya`)
        return {
          needConfirm: true,
          warning:
            `Isi per kemasan berubah (${oldFactor ?? 'kosong'} → ${newFactor ?? 'kosong'}).\n` +
            `${holders.length} user memiliki saldo produk ini. Saldo akan DIKONVERSI otomatis ke satuan baru:\n` +
            `${lines.join('\n')}\n\n` +
            `Pengajuan FO yang masih menunggu persetujuan tetap memakai angka lama; periksa sebelum menyetujui.\n` +
            `Lanjutkan simpan?`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: {
        code: code || null, name, description: description || null, unit,
        unitGramasi: unitGramasi || null,
        gramasiPerUnit: newGramasi,
      }})
      for (const h of holders) {
        const delta = h.converted - h.balance
        if (Math.abs(delta) < 0.0001) continue
        await tx.ledger.create({
          data: {
            userId: h.userId,
            productId: id,
            transactionType: 'UNIT_CONVERSION',
            quantity: delta,
            notes: `Konversi satuan: ${h.balance} ${oldUnitLabel} → ${h.converted} ${newUnitLabel} (isi per kemasan ${oldFactor ?? '-'} → ${newFactor ?? '-'})`,
          },
        })
      }
    }, { maxWait: 5000, timeout: 30000 })
    revalidatePath('/dashboard/master/products')
    invalidateCacheTag(CACHE_TAGS.products)
    return { success: true, convertedUsers: holders.length }
  } catch { return { error: 'Gagal mengupdate produk.' } }
}

export async function deleteProduct(id: string) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  try {
    await prisma.product.delete({ where: { id } })
    revalidatePath('/dashboard/master/products')
    invalidateCacheTag(CACHE_TAGS.products)
    return { success: true }
  } catch { return { error: 'Gagal menghapus produk. Mungkin ada stok atau request yang terkait.' } }
}

// ─── BULK DELETE ─────────────────────────────────
export async function bulkDeleteAreas(ids: string[]) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.area.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus area. Pastikan tidak ada user yang terkait.' } }
}

export async function bulkDeleteFarmers(ids: string[]) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.farmer.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/areas')
    return { success: true }
  } catch { return { error: 'Gagal menghapus petani.' } }
}

export async function bulkDeleteUsers(ids: string[]) {
  const session = await requireMaster()
  if (!session) return { error: FORBIDDEN }
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  if (session.role !== 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { id: { in: ids }, role: 'ADMIN' } })
    if (adminCount > 0) return { error: ADMIN_ONLY }
  }
  try {
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/users')
    return { success: true }
  } catch { return { error: 'Gagal menghapus users. Mungkin ada data yang terkait.' } }
}

export async function bulkDeleteProducts(ids: string[]) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    // Produk yang sudah punya riwayat stok tidak boleh dihapus: menghapusnya ikut menghapus
    // seluruh riwayat Ledger semua user dan mengubah saldo tanpa jejak.
    const withHistory = await prisma.product.findMany({
      where: {
        id: { in: ids },
        OR: [{ ledgers: { some: {} } }, { sampleLedgers: { some: {} } }],
      },
      select: { name: true },
    })
    if (withHistory.length > 0) {
      const names = withHistory.slice(0, 10).map(p => p.name).join(', ')
      return {
        error: `${withHistory.length} produk tidak dapat dihapus karena sudah punya riwayat stok: ${names}${withHistory.length > 10 ? ', ...' : ''}. ` +
          'Kosongkan saldonya lewat penyesuaian stok bila produk tidak dipakai lagi.',
      }
    }

    // Must delete all related records first (no CASCADE configured in schema)
    await prisma.$transaction([
      // 1. Ledger produk ini dipastikan kosong (dicek di atas)
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
    invalidateCacheTag(CACHE_TAGS.products)
    return { success: true }
  } catch (e: any) {
    console.error('Bulk delete products error:', e)
    return { error: 'Gagal menghapus produk: ' + (e?.message ?? 'Terjadi kesalahan.') }
  }
}

// ─── STORE (TOKO / PELANGGAN) ────────────────────────────────────
export async function createStore(formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
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
    invalidateCacheTag(CACHE_TAGS.stores)
    return { success: true }
  } catch { return { error: 'Gagal menyimpan data toko.' } }
}

export async function updateStore(id: string, formData: FormData) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
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
    invalidateCacheTag(CACHE_TAGS.stores)
    return { success: true }
  } catch { return { error: 'Gagal mengupdate data toko.' } }
}

export async function deleteStore(id: string) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  try {
    await prisma.store.delete({ where: { id } })
    revalidatePath('/dashboard/master/stores')
    invalidateCacheTag(CACHE_TAGS.stores)
    return { success: true }
  } catch { return { error: 'Gagal menghapus toko.' } }
}

export async function bulkDeleteStores(ids: string[]) {
  if (!(await requireMaster())) return { error: FORBIDDEN }
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await prisma.store.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/dashboard/master/stores')
    invalidateCacheTag(CACHE_TAGS.stores)
    return { success: true }
  } catch { return { error: 'Gagal menghapus toko.' } }
}

