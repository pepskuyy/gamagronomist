'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// FO submit Request
export async function submitRequestDemoPlot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'FO') {
    return { error: 'Hanya FO yang dapat membuat request Demo Plot' }
  }

  const farmerName = formData.get('farmerName') as string
  const farmerPhone = formData.get('farmerPhone') as string
  const area = formData.get('area') as string
  const commodity = formData.get('commodity') as string
  const problem = formData.get('problem') as string
  const plan = formData.get('plan') as string
  
  // Array of produk IDs and quantities, parsing from dynamic inputs
  // For simplicity MVP we expect JSON string from input hidden
  const productsJSON = formData.get('products') as string
  let productsToRequest: { productId: string, qtyRequested: number }[] = []
  
  try {
    if (productsJSON) productsToRequest = JSON.parse(productsJSON)
  } catch (e) {
    return { error: 'Gagal membaca daftar produk.' }
  }

  if (productsToRequest.length === 0 || productsToRequest.length > 5) {
    return { error: 'Produk minimal 1 dan maksimal 5 jenis.' }
  }

  try {
    // 1. Check or Create Farmer dynamically
    let farmer = await prisma.farmer.findFirst({ where: { name: farmerName, area } })
    if (!farmer) {
      farmer = await prisma.farmer.create({
        data: { name: farmerName, phone: farmerPhone, area }
      })
    }

    // 2. Create the Request with Details
    const newReq = await prisma.request.create({
      data: {
        foId: session.userId,
        afaId: session.afaId, // automatically routed to supervisor
        farmerId: farmer.id,
        area,
        commodity,
        problem,
        plan,
        status: 'SUBMITTED',
        details: {
          create: productsToRequest.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested
          }))
        }
      }
    })

    return { success: true, requestId: newReq.id }
  } catch (err: any) {
    console.error('Submit request error', err)
    return { error: 'Gagal membuat pengajuan Demo Plot. Coba lagi.' }
  }
}
