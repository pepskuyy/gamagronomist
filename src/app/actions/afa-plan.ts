'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

/**
 * AFA creates their own Demo Plot plan.
 * The Request is immediately set to APPROVED — no approval from SPV needed.
 * The AFA acts as both the plan creator (afaId) and the executor.
 */
export async function submitAfaSelfPlan(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA') {
    return { error: 'Hanya AFA yang dapat membuat perencanaan mandiri.' }
  }

  const farmerName   = formData.get('farmerName')   as string
  const farmerPhone  = formData.get('farmerPhone')  as string
  const area         = formData.get('area')          as string
  const commodity    = formData.get('commodity')     as string
  const problem      = formData.get('problem')       as string
  const plan         = formData.get('plan')          as string
  const productsJSON = formData.get('products')      as string

  let products: { productId: string; qtyRequested: number }[] = []
  try {
    if (productsJSON) products = JSON.parse(productsJSON)
  } catch {
    return { error: 'Gagal membaca daftar produk.' }
  }

  if (products.length === 0 || products.length > 5) {
    return { error: 'Produk minimal 1 dan maksimal 5 jenis.' }
  }

  try {
    // Get or create farmer
    let farmer = await prisma.farmer.findFirst({ where: { name: farmerName, area } })
    if (!farmer) {
      farmer = await prisma.farmer.create({ data: { name: farmerName, phone: farmerPhone, area } })
    }

    // Create Request: foId = afaId (AFA is acting as FO for their own plan)
    // status is immediately APPROVED — no upstream approval needed
    const newReq = await prisma.request.create({
      data: {
        foId: session.userId,    // AFA fills the "FO" slot for execution
        afaId: session.userId,   // Also the AFA
        farmerId: farmer.id,
        area,
        commodity,
        problem,
        plan,
        status: 'APPROVED',      // Auto-approved, no SPV review needed
        details: {
          create: products.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
            qtyApproved: p.qtyRequested  // Self-approved quantities
          }))
        }
      }
    })

    revalidatePath('/dashboard/demoplot')
    return { success: true, requestId: newReq.id }
  } catch (err: any) {
    console.error('AFA Self Plan Error:', err)
    return { error: 'Gagal membuat perencanaan. Coba lagi.' }
  }
}
