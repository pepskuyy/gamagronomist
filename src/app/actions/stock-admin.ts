'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { assertStockAvailable, StockShortageError, findUndecidedUnitProducts, unitHoldMessage } from '@/lib/ledger/stock'

// Pengurangan tidak boleh melebihi saldo produk itu. Saldo minus akibat penyesuaian
// biasanya berarti SKU yang dipilih keliru (ada produk kembar) atau angka salah ketik.
const ADJUST_SHORTAGE_HINT = 'Pengurangan tidak boleh melebihi saldo. Periksa apakah SKU yang dipilih sudah benar (ada produk dengan nama mirip) dan satuannya ml/gr.'
const TRANSFER_SHORTAGE_HINT = 'Jumlah yang dipindahkan tidak boleh melebihi saldo akun asal.'

const STOCK_HOLDER_ROLES = ['AFA', 'FO', 'INTERN', 'PLANTATION', 'BD']

export async function adjustStock(formData: FormData) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role)) {
      return { error: 'Anda tidak memiliki akses untuk aksi ini.' }
    }

    const userId = formData.get('userId') as string
    const productId = formData.get('productId') as string
    const type = formData.get('type') as 'plus' | 'minus'
    const quantityStr = formData.get('quantity') as string
    const notes = formData.get('notes') as string

    if (!userId || !productId || !type || !quantityStr || !notes) {
      return { error: 'Form tidak lengkap.' }
    }

    let quantity = parseFloat(quantityStr)
    if (isNaN(quantity) || quantity <= 0) {
      return { error: 'Jumlah harus lebih besar dari 0.' }
    }

    if (type === 'minus') {
      quantity = -quantity
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return { error: 'Produk tidak ditemukan.' }
    const held = await findUndecidedUnitProducts(prisma, [productId])
    if (held.length > 0) return { error: unitHoldMessage(held) }

    // Admin/SPV adjustment — lookup target user's area for snapshot
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { areaId: true } })

    await prisma.$transaction(async (tx) => {
      if (quantity < 0) await assertStockAvailable(tx, userId, [{ productId, qty: -quantity }], ADJUST_SHORTAGE_HINT)

      // 1. Create Ledger Entry
      await tx.ledger.create({
        data: {
          userId,
          productId,
          transactionType: quantity > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
          quantity,
          snapshotAreaId: targetUser?.areaId ?? null,
          notes: `[Penyesuaian oleh ${session.name}] ${notes}`
        }
      })

      // 2. Create Notification to User
      const sign = quantity > 0 ? '+' : ''
      await tx.notification.create({
        data: {
          userId,
          title: '🔄 Penyesuaian Stok',
          message: `Stok ${product.name} disesuaikan sebesar ${sign}${quantity} ${product.unitGramasi || product.unit}.\nKeterangan: ${notes}`,
          link: '/dashboard/stock/history' // link to their history
        }
      })
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (error) {
    if (error instanceof StockShortageError) return { error: error.message }
    console.error('Adjust stock error:', error)
    return { error: 'Terjadi kesalahan sistem.' }
  }
}

// ── Batch adjustment (multi-product) ──────────────────────────────────────

type AdjustItem = {
  productId: string
  type: 'plus' | 'minus'
  quantity: number
}

export async function adjustStockBatch(data: {
  userId: string
  items: AdjustItem[]
  notes: string
}) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role)) {
      return { error: 'Anda tidak memiliki akses untuk aksi ini.' }
    }

    const { userId, items, notes } = data
    if (!userId || !items.length || !notes.trim()) {
      return { error: 'Data tidak lengkap.' }
    }

    // Validate all items
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) {
        return { error: 'Semua produk harus memiliki jumlah > 0.' }
      }
    }

    const held = await findUndecidedUnitProducts(prisma, items.map(i => i.productId))
    if (held.length > 0) return { error: unitHoldMessage(held) }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { areaId: true } })
    const productIds = items.map(i => i.productId)
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true, unitGramasi: true }
    })
    const productMap = new Map(productsData.map(p => [p.id, p]))

    await prisma.$transaction(async (tx) => {
      await assertStockAvailable(
        tx,
        userId,
        items.filter(i => i.type === 'minus').map(i => ({ productId: i.productId, qty: i.quantity })),
        ADJUST_SHORTAGE_HINT,
      )

      for (const item of items) {
        const product = productMap.get(item.productId)
        if (!product) continue

        const qty = item.type === 'minus' ? -item.quantity : item.quantity

        await tx.ledger.create({
          data: {
            userId,
            productId: item.productId,
            transactionType: qty > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
            quantity: qty,
            snapshotAreaId: targetUser?.areaId ?? null,
            notes: `[Penyesuaian oleh ${session.name}] ${notes}`
          }
        })

        const sign = qty > 0 ? '+' : ''
        await tx.notification.create({
          data: {
            userId,
            title: '🔄 Penyesuaian Stok',
            message: `Stok ${product.name} disesuaikan sebesar ${sign}${qty} ${product.unitGramasi || product.unit}.\nKeterangan: ${notes}`,
            link: '/dashboard/stock/history'
          }
        })
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (error) {
    if (error instanceof StockShortageError) return { error: error.message }
    console.error('Adjust stock batch error:', error)
    return { error: 'Terjadi kesalahan sistem.' }
  }
}

// ── Pindah stok antar akun ────────────────────────────────────────────────
// Pengganti "transfer lewat Penyesuaian" (kurangi di akun A, tambah di akun B secara terpisah),
// yang sering salah SKU, salah tanda, atau jumlahnya tidak sama di kedua sisi.
// Di sini kedua baris ditulis sekaligus: SKU dan jumlah sama, saldo asal dicek dulu.

export async function transferStockBetweenUsers(data: {
  fromUserId: string
  toUserId: string
  items: { productId: string; quantity: number }[]
  notes: string
}) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role)) {
      return { error: 'Anda tidak memiliki akses untuk aksi ini.' }
    }

    const { fromUserId, toUserId, items, notes } = data
    if (!fromUserId || !toUserId || !items.length || !notes.trim()) return { error: 'Data tidak lengkap.' }
    if (fromUserId === toUserId) return { error: 'Akun asal dan tujuan tidak boleh sama.' }
    if (items.some(i => !i.productId || !(i.quantity > 0))) return { error: 'Semua produk harus memiliki jumlah > 0.' }
    if (new Set(items.map(i => i.productId)).size !== items.length) return { error: 'Tidak boleh ada produk yang sama dalam satu pemindahan.' }

    const users = await prisma.user.findMany({
      where: { id: { in: [fromUserId, toUserId] } },
      select: { id: true, name: true, role: true, areaId: true },
    })
    const from = users.find(u => u.id === fromUserId)
    const to = users.find(u => u.id === toUserId)
    if (!from || !to) return { error: 'Akun tidak ditemukan.' }
    if (!STOCK_HOLDER_ROLES.includes(to.role)) return { error: 'Akun tujuan bukan pemegang stok.' }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) } },
      select: { id: true, name: true, unit: true, unitGramasi: true },
    })
    const productMap = new Map(products.map(p => [p.id, p]))
    if (productMap.size !== items.length) return { error: 'Produk tidak ditemukan.' }

    const held = await findUndecidedUnitProducts(prisma, items.map(i => i.productId))
    if (held.length > 0) return { error: unitHoldMessage(held) }

    const transferId = randomUUID()
    const note = notes.trim()

    await prisma.$transaction(async (tx) => {
      await assertStockAvailable(tx, fromUserId, items.map(i => ({ productId: i.productId, qty: i.quantity })), TRANSFER_SHORTAGE_HINT)

      for (const item of items) {
        await tx.ledger.create({
          data: {
            userId: fromUserId,
            productId: item.productId,
            transactionType: 'TRANSFER_ACCOUNT_OUT',
            quantity: -item.quantity,
            referenceId: transferId,
            snapshotAreaId: from.areaId ?? null,
            notes: `[Pindah ke ${to.name} oleh ${session.name}] ${note}`,
          },
        })
        await tx.ledger.create({
          data: {
            userId: toUserId,
            productId: item.productId,
            transactionType: 'TRANSFER_ACCOUNT_IN',
            quantity: item.quantity,
            referenceId: transferId,
            snapshotAreaId: to.areaId ?? null,
            notes: `[Pindah dari ${from.name} oleh ${session.name}] ${note}`,
          },
        })
      }

      const list = items
        .map(i => { const p = productMap.get(i.productId)!; return `${p.name} ${i.quantity} ${p.unitGramasi || p.unit}` })
        .join(', ')
      await tx.notification.createMany({
        data: [
          { userId: fromUserId, title: '🔁 Stok Dipindahkan', message: `Stok dipindahkan ke ${to.name}: ${list}.\nKeterangan: ${note}`, link: '/dashboard/stock/history' },
          { userId: toUserId, title: '🔁 Stok Masuk dari Akun Lain', message: `Stok masuk dari ${from.name}: ${list}.\nKeterangan: ${note}`, link: '/dashboard/stock/history' },
        ],
      })
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (error) {
    if (error instanceof StockShortageError) return { error: error.message }
    console.error('Transfer stock between users error:', error)
    return { error: 'Terjadi kesalahan sistem.' }
  }
}
