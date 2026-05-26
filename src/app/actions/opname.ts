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
    // 1. Hitung saldo stok sistem saat ini (luar transaksi agar tidak timeout)
    const currentStocks = await getStockBalance(session.userId)
    
    // 2. Hitung selisih & validasi SEBELUM menulis ke DB
    const details: {
      productId: string
      systemStock: number
      physicalStock: number
      variance: number
      notes: string
    }[] = []

    for (const count of counts) {
      const systemStockObj = currentStocks.find(s => s.product.id === count.productId)
      const systemStock    = systemStockObj ? systemStockObj.quantity : 0
      const physicalStock  = Number(count.physicalQty)
      const variance       = physicalStock - systemStock

      // Jika ada selisih tapi tidak ada keterangan, tolak sebelum masuk DB
      if (variance !== 0 && (!count.notes || count.notes.trim() === '')) {
        throw new Error(`Keterangan wajib diisi untuk selisih pada ID Produk ${count.productId}`)
      }

      details.push({
        productId:    count.productId,
        systemStock,
        physicalStock,
        variance,
        notes: count.notes?.trim() || (variance !== 0 ? 'Terdapat selisih' : 'Sesuai'),
      })
    }

    // 3. Buat header opname + semua detail dalam satu batch (tidak pakai interactive tx)
    const opname = await prisma.stockOpname.create({
      data: { userId: session.userId, status: 'SUBMITTED' }
    })

    // createMany jauh lebih cepat dan tidak perlu interactive transaction
    await prisma.opnameDetail.createMany({
      data: details.map(d => ({
        opnameId:     opname.id,
        productId:    d.productId,
        systemStock:  d.systemStock,
        physicalStock: d.physicalStock,
        variance:     d.variance,
        notes:        d.notes,
      })),
    })

    return { success: true }
  } catch (err: any) {
    console.error('Opname Error:', err)
    return { error: err.message || 'Terjadi kesalahan sistem saat memproses Opname.' }
  }
}
