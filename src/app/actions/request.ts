'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * FO submits a stock pickup request to their AFA.
 * No longer requires farmer or demo plot details — just product quantities needed.
 */
export async function submitRequestDemoPlot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'FO') {
    return { error: 'Hanya FO yang dapat membuat request pengambilan stok.' }
  }

  const notes = (formData.get('notes') as string) || ''
  const productsJSON = formData.get('products') as string
  let productsToRequest: { productId: string; qtyRequested: number }[] = []

  try {
    if (productsJSON) productsToRequest = JSON.parse(productsJSON)
  } catch {
    return { error: 'Gagal membaca daftar produk.' }
  }

  if (productsToRequest.length === 0 || productsToRequest.length > 5) {
    return { error: 'Produk minimal 1 dan maksimal 5 jenis.' }
  }

  try {
    const newReq = await prisma.request.create({
      data: {
        foId: session.userId,
        afaId: session.afaId,
        // farmer and demo plot fields are no longer required at request stage
        farmerId: null,
        area: notes || 'Pengajuan Stok',
        commodity: '-',
        problem: '-',
        plan: notes || '-',
        status: 'SUBMITTED',
        details: {
          create: productsToRequest.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
          })),
        },
      },
    })
    return { success: true, requestId: newReq.id }
  } catch (err: any) {
    console.error('Submit request error', err)
    return { error: 'Gagal membuat pengajuan. Coba lagi.' }
  }
}
