'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

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

    // Admin/SPV adjustment — lookup target user's area for snapshot
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { areaId: true } })

    await prisma.$transaction(async (tx) => {
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
          message: `Stok ${product.name} disesuaikan sebesar ${sign}${quantity} ${product.unit}.\nKeterangan: ${notes}`,
          link: '/dashboard/stock/history' // link to their history
        }
      })
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (error) {
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { areaId: true } })
    const productIds = items.map(i => i.productId)
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true }
    })
    const productMap = new Map(productsData.map(p => [p.id, p]))

    await prisma.$transaction(async (tx) => {
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
            message: `Stok ${product.name} disesuaikan sebesar ${sign}${qty} ${product.unit}.\nKeterangan: ${notes}`,
            link: '/dashboard/stock/history'
          }
        })
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (error) {
    console.error('Adjust stock batch error:', error)
    return { error: 'Terjadi kesalahan sistem.' }
  }
}
