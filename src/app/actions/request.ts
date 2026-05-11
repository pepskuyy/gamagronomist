'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * FO submits a stock pickup request to their AFA.
 * No longer requires farmer or demo plot details — just product quantities needed.
 */
export async function submitRequestDemoPlot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'FO' && session?.role !== 'INTERN') {
    return { error: 'Hanya FO yang dapat membuat request pengambilan stok.' }
  }

  const notes = (formData.get('notes') as string) || ''
  const productsJSON = formData.get('products') as string
  let productsToRequest: { productId: string; qtyRequested: number; requestUnit?: string }[] = []

  try {
    if (productsJSON) productsToRequest = JSON.parse(productsJSON)
  } catch {
    return { error: 'Gagal membaca daftar produk.' }
  }

  if (productsToRequest.length === 0) {
    return { error: 'Produk minimal 1 jenis.' }
  }

  // If requestUnit not provided, look up from Product table
  // requestUnit HARUS menyimpan satuan kemasan (unit: PCS, Btl, dll),
  // BUKAN unitGramasi (ml, g, dll). unitGramasi hanya dipakai untuk konversi display.
  if (productsToRequest.some(p => !p.requestUnit)) {
    const products = await prisma.product.findMany({
      where: { id: { in: productsToRequest.map(p => p.productId) } },
      select: { id: true, unit: true, unitGramasi: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))
    for (const p of productsToRequest) {
      if (!p.requestUnit) {
        const prod = productMap.get(p.productId)
        // Gunakan unit kemasan (PCS, Botol, dsb), bukan unitGramasi (ml, g, dsb)
        p.requestUnit = prod?.unit || 'PCS'
      }
    }
  }

  try {
    const newReq = await prisma.request.create({
      data: {
        foId: session.userId,
        afaId: session.afaId,
        farmerId: null,
        area: notes || 'Pengajuan Stok',
        snapshotAreaId: session.areaId ?? null,
        commodity: '-',
        problem: '-',
        plan: notes || '-',
        status: 'SUBMITTED',
        details: {
          create: productsToRequest.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
            requestUnit: p.requestUnit || null,
          })),
        },
      },
    })

    if (session.afaId) {
      await prisma.notification.create({
        data: {
          userId: session.afaId,
          title: '📩 Permintaan Stok Baru (FO)',
          message: `${session.name} mengajukan permintaan pengambilan stok baru.`,
          link: `/dashboard/demoplot/detail/${newReq.id}`
        }
      })
    }

    return { success: true, requestId: newReq.id }
  } catch (err: any) {
    console.error('Submit request error', err)
    return { error: 'Gagal membuat pengajuan. Coba lagi.' }
  }
}
