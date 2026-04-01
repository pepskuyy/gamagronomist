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

    // Admin/SPV adjustment
    await prisma.$transaction(async (tx) => {
      // 1. Create Ledger Entry
      await tx.ledger.create({
        data: {
          userId,
          productId,
          transactionType: quantity > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
          quantity,
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
