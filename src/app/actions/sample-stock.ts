'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

/** SPV menambahkan stok masuk ke Gudang Sampel secara manual */
export async function addSampleStock(formData: FormData) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)

  if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
    return { error: 'Hanya SPV yang dapat mengelola Gudang Sampel.' }
  }

  const mode     = (formData.get('mode') as string) || 'existing'
  const quantity = parseFloat(formData.get('quantity') as string)
  const notes    = (formData.get('notes') as string)?.trim() || null

  if (!quantity || quantity <= 0) return { error: 'Jumlah harus lebih dari 0.' }

  try {
    let productId: string

    if (mode === 'new') {
      // ── Buat produk baru ──────────────────────────────────────────────
      const newName  = (formData.get('newName') as string)?.trim()
      // Automatically generate SKU code starting with SMPL-
      const newCode  = `SMPL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      const newUnit  = (formData.get('newUnit') as string)?.trim() || 'PCS'
      const newUnitGramasi    = (formData.get('newUnitGramasi') as string)?.trim() || null
      const newGramasiPerUnit = formData.get('newGramasiPerUnit') ? parseFloat(formData.get('newGramasiPerUnit') as string) : null

      if (!newName) return { error: 'Nama produk baru wajib diisi.' }

      const product = await prisma.product.create({
        data: {
          name: newName,
          code: newCode,
          unit: newUnit,
          unitGramasi: newUnitGramasi,
          gramasiPerUnit: newGramasiPerUnit,
          // accurateId sengaja dikosongkan — produk sampel tidak terdaftar di Accurate
        }
      })
      productId = product.id

    } else {
      // ── Pilih dari produk existing ────────────────────────────────────
      productId = (formData.get('productId') as string)?.trim()
      if (!productId) return { error: 'Produk wajib dipilih.' }
    }

    await prisma.sampleLedger.create({
      data: {
        userId: session.userId,
        productId,
        quantity: Math.abs(quantity),
        transactionType: 'SAMPLE_IN',
        notes,
      },
    })
    revalidatePath('/dashboard/stock/sample')
    return { success: true }

  } catch (err: any) {
    console.error('addSampleStock error:', err)
    return { error: 'Gagal menyimpan stok sampel.' }
  }
}


/** Ambil saldo stok sampel per produk untuk SPV tertentu */
export async function getSampleBalance(userId: string): Promise<{ productId: string; productName: string; unit: string; balance: number }[]> {
  const ledgers = await prisma.sampleLedger.findMany({
    where: { userId },
    include: { product: { select: { id: true, name: true, unit: true, unitGramasi: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const balanceMap = new Map<string, { productId: string; productName: string; unit: string; balance: number }>()
  for (const l of ledgers) {
    const existing = balanceMap.get(l.productId)
    const unit = l.product.unit // Selalu gunakan satuan kemasan (PCS, Botol, dsb)
    if (existing) {
      existing.balance += l.quantity
    } else {
      balanceMap.set(l.productId, { productId: l.productId, productName: l.product.name, unit, balance: l.quantity })
    }
  }

  return Array.from(balanceMap.values()).filter(b => b.balance !== 0)
}

/** Melakukan penyesuaian (opname) stok sampel secara langsung tanpa approval */
export async function adjustSampleStock(formData: FormData) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)

  if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
    return { error: 'Hanya SPV yang dapat melakukan Opname Gudang Sampel.' }
  }

  const adjustmentsRaw = formData.get('adjustments') as string
  if (!adjustmentsRaw) return { error: 'Data penyesuaian kosong.' }

  try {
    const adjustments = JSON.parse(adjustmentsRaw) as { productId: string, difference: number, notes: string }[]
    if (!adjustments.length) return { error: 'Tidak ada data yang disesuaikan.' }

    // Buat transaksi secara bulk untuk setiap perubahan
    const operations = adjustments.filter(adj => adj.difference !== 0).map(adj => {
      const type = adj.difference > 0 ? 'OPNAME_PLUS' : 'OPNAME_MINUS'
      return prisma.sampleLedger.create({
        data: {
          userId: session.userId,
          productId: adj.productId,
          quantity: adj.difference, // difference is positive (in) or negative (out)
          transactionType: type,
          notes: adj.notes || 'Penyesuaian Opname',
        }
      })
    })

    if (operations.length > 0) {
      await prisma.$transaction(operations)
      revalidatePath('/dashboard/stock/sample')
    }

    return { success: true }
  } catch (err: any) {
    console.error('adjustSampleStock error:', err)
    return { error: 'Terjadi kesalahan saat memproses Opname Stok Sampel.' }
  }
}

/** Edit nama dan satuan produk sampel */
export async function editSampleProduct(
  productId: string,
  name: string,
  unitGramasi: string | null,
  gramasiPerUnit: number | null,
) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)

  if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
    return { error: 'Hanya SPV yang dapat mengedit produk sampel.' }
  }

  const trimName = name.trim()
  if (!trimName) return { error: 'Nama produk tidak boleh kosong.' }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: trimName,
        unitGramasi: unitGramasi?.trim() || null,
        gramasiPerUnit: gramasiPerUnit ?? null,
      },
    })
    revalidatePath('/dashboard/stock/sample')
    return { success: true }
  } catch (err: any) {
    console.error('editSampleProduct error:', err)
    return { error: 'Gagal mengupdate produk.' }
  }
}

/**
 * Hapus produk dari gudang sampel:
 * - Jika balance > 0, buat entri SAMPLE_VOID untuk zeroing stok
 * - Jika produk SMPL- (dibuat custom), hapus dari tabel Product juga
 * - Jika produk Accurate (punya accurateId), hanya nol-kan balance
 */
export async function removeSampleProduct(productId: string, currentBalance: number) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)

  if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
    return { error: 'Hanya SPV yang dapat menghapus produk sampel.' }
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, accurateId: true, name: true },
    })
    if (!product) return { error: 'Produk tidak ditemukan.' }

    // Jika masih ada saldo, buat entri void untuk zeroing
    if (currentBalance !== 0) {
      await prisma.sampleLedger.create({
        data: {
          userId: session.userId,
          productId,
          quantity: -currentBalance, // nol-kan saldo
          transactionType: 'OPNAME_MINUS',
          notes: `[VOID] Produk dihapus dari Gudang Sampel oleh SPV`,
        },
      })
    }

    // Jika produk custom (SMPL-) dan tidak punya accurateId, hapus dari Product
    const isCustom = product.code?.startsWith('SMPL-') && !product.accurateId
    if (isCustom) {
      // Hapus semua ledger entries dulu, lalu hapus produk
      await prisma.sampleLedger.deleteMany({ where: { productId } })
      // Cek apakah produk dipakai di tabel lain sebelum hapus
      const usedInRequest = await prisma.requestDetail.findFirst({ where: { productId } })
      const usedInLedger  = await prisma.ledger.findFirst({ where: { productId } })
      if (!usedInRequest && !usedInLedger) {
        await prisma.product.delete({ where: { id: productId } })
      }
    }

    revalidatePath('/dashboard/stock/sample')
    return { success: true }
  } catch (err: any) {
    console.error('removeSampleProduct error:', err)
    return { error: 'Gagal menghapus produk: ' + err.message }
  }
}
