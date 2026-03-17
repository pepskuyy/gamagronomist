'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { getStockBalance } from '@/lib/ledger/stock'

const prisma = new PrismaClient()

export async function submitStockOpname(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return { error: 'Unauthorized' }

  // Array of physical counts 
  const countsJSON = formData.get('counts') as string
  let counts: { productId: string, physicalQty: number }[] = []
  
  try {
    if (countsJSON) counts = JSON.parse(countsJSON)
  } catch (e) {
    return { error: 'Gagal membaca data opname.' }
  }

  if (counts.length === 0) return { error: 'Minimal 1 produk di-opname' }

  try {
    const currentStocks = await getStockBalance(session.userId)
    
    await prisma.$transaction(async (tx) => {
      // 1. Create Stock Opname Header
      const opname = await tx.stockOpname.create({
        data: {
          userId: session.userId,
          status: 'ADJUSTED'
        }
      })

      // 2. Calculate Variance & Adjust Ledger
      for (const count of counts) {
        const systemStockObj = currentStocks.find(s => s.product.id === count.productId)
        const systemStock = systemStockObj ? systemStockObj.quantity : 0
        const physicalStock = Number(count.physicalQty)
        const variance = physicalStock - systemStock

        // Simpan Record Detail
        await tx.opnameDetail.create({
          data: {
            opnameId: opname.id,
            productId: count.productId,
            systemStock,
            physicalStock,
            variance,
            notes: variance !== 0 ? 'Koreksi Stok Otomatis' : 'Sesuai'
          }
        })

        // Adjust Ledger jika ada selisih
        if (variance !== 0) {
          const txType = variance > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS'
          await tx.ledger.create({
            data: {
              userId: session.userId,
              productId: count.productId,
              transactionType: txType,
              quantity: variance, // otomatis positif/negatif
              referenceId: opname.id,
              notes: `Adjustment via Opname id ${opname.id.slice(0, 8)}`
            }
          })
        }
      }
    })

    return { success: true }
  } catch (err: any) {
    console.error('Opname Error:', err)
    return { error: 'Terjadi kesalahan sistem saat memproses Opname.' }
  }
}
