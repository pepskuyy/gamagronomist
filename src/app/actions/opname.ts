'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'


export async function submitStockOpname(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return { error: 'Unauthorized' }

  // Array of physical counts included with notes
  const countsJSON = formData.get('counts') as string
  let counts: { productId: string, physicalQty: number, notes?: string }[] = []
  
  try {
    if (countsJSON) counts = JSON.parse(countsJSON)
  } catch (e) {
    return { error: 'Gagal membaca data opname.' }
  }

  if (counts.length === 0) return { error: 'Minimal 1 produk di-opname' }

  try {
    const currentStocks = await getStockBalance(session.userId)
    
    await prisma.$transaction(async (tx) => {
      // 1. Create Stock Opname Header (Status SUBMITTED by default as per schema)
      const opname = await tx.stockOpname.create({
        data: {
          userId: session.userId,
          status: 'SUBMITTED'
        }
      })

      // 2. Calculate Variance & Save Detail (TIDAK adjust Ledger dulu)
      for (const count of counts) {
        const systemStockObj = currentStocks.find(s => s.product.id === count.productId)
        const systemStock = systemStockObj ? systemStockObj.quantity : 0
        const physicalStock = Number(count.physicalQty)
        const variance = physicalStock - systemStock

        // Jika selisih dan tidak ada notes, lemparkan error
        if (variance !== 0 && (!count.notes || count.notes.trim() === '')) {
            throw new Error(`Keterangan wajib diisi untuk selisih pada ID Produk ${count.productId}`)
        }

        // Simpan Record Detail
        await tx.opnameDetail.create({
          data: {
            opnameId: opname.id,
            productId: count.productId,
            systemStock,
            physicalStock,
            variance,
            notes: count.notes || (variance !== 0 ? 'Terdapat selisih' : 'Sesuai')
          }
        })
      }
    })

    return { success: true }
  } catch (err: any) {
    console.error('Opname Error:', err)
    return { error: err.message || 'Terjadi kesalahan sistem saat memproses Opname.' }
  }
}
