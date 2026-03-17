'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { insertStockInGudang } from '@/lib/ledger/stock'

export async function submitStockIn(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA' && session?.role !== 'ADMIN') {
    return { error: 'Anda tidak memiliki akses untuk aksi ini.' }
  }

  const productId = formData.get('productId') as string
  const quantity = Number(formData.get('quantity'))
  const notes = formData.get('notes') as string

  if (!productId || quantity <= 0) {
    return { error: 'Produk dan kuantitas wajib diisi dengan benar!' }
  }

  try {
    await insertStockInGudang(session.userId, productId, quantity, notes)
    return { success: true }
  } catch (err: any) {
    console.error('Error insert stock in gudang:', err)
    return { error: 'Terjadi kesalahan sistem.' }
  }
}
