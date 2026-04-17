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
      const newCode  = (formData.get('newCode') as string)?.trim() || null
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
    const unit = l.product.unitGramasi || l.product.unit
    if (existing) {
      existing.balance += l.quantity
    } else {
      balanceMap.set(l.productId, { productId: l.productId, productName: l.product.name, unit, balance: l.quantity })
    }
  }

  return Array.from(balanceMap.values()).filter(b => b.balance !== 0)
}
