'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

/**
 * AFA requests stock to be approved by SPV.
 * Creates a Request with commodity="AFA_STOCK_IN".
 */
export async function submitAfaStockRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA') {
    return { error: 'Hanya AFA yang dapat mengajukan permintaan stok masuk.' }
  }

  const notes = (formData.get('notes') as string)?.trim() || '-'
  const productsJSON = formData.get('products') as string
  let products: { productId: string; qtyRequested: number }[] = []

  try {
    if (productsJSON) products = JSON.parse(productsJSON)
  } catch {
    return { error: 'Gagal membaca data produk.' }
  }

  const validProducts = products.filter(p => p.qtyRequested > 0)
  if (validProducts.length === 0) {
    return { error: 'Pilih minimal 1 produk dan masukkan jumlah yang valid.' }
  }

  try {
    const req = await prisma.request.create({
      data: {
        foId: session.userId, // We trace the requester via foId
        commodity: 'AFA_STOCK_IN',
        plan: notes,
        status: 'SUBMITTED',
        details: {
          create: validProducts.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
            qtyApproved: p.qtyRequested, // Auto-copy requested to approved initially
          }))
        }
      }
    })

    // Cari SPV dari area yang sama dengan AFA
    const afaUser = await prisma.user.findUnique({ where: { id: session.userId } })
    if (afaUser && afaUser.areaId) {
      const spvs = await prisma.user.findMany({ where: { role: 'SPV', areaId: afaUser.areaId } })
      // Notify sema SPV di area tersebut
      for (const spv of spvs) {
        await prisma.notification.create({
          data: {
            userId: spv.id,
            title: '📩 Pengajuan Stok Baru (AFA)',
            message: `${afaUser.name} telah mengajukan permintaan restock gudang AFA.`,
            link: `/dashboard/stock`
          }
        })
      }
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('submitAfaStockRequest error:', err)
    return { error: 'Gagal mengirim pengajuan stok.' }
  }
}

/**
 * SPV approves an AFA's stock request.
 * Updates the Request status and instantly adds the stock to the AFA's ledger.
 */
export async function approveAfaStockRequest(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'SPV') {
    return { error: 'Hanya SPV yang dapat menyetujui permintaan stok AFA.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true } // fo is the AFA
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'SUBMITTED') {
      return { error: 'Pengajuan ini sudah pernah diproses.' }
    }

    // 1. Update Request to APPROVED and store the approver in afaId (mental map: SPV acts as approver)
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        afaId: session.userId, // Storing SPV ID as the approver
      }
    })

    // 2. Add stock to AFA's ledger — convert kemasan qty → gramasi qty (Opsi B)
    // Fetch product info to get gramasiPerUnit for conversion
    const productIds = req.details.map(d => d.productId)
    const productInfos = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, gramasiPerUnit: true, unitGramasi: true, unit: true },
    })
    const productMap = new Map(productInfos.map(p => [p.id, p]))

    await prisma.ledger.createMany({
      data: req.details.map(d => {
        const prod = productMap.get(d.productId)
        const qtyKemasan = d.qtyApproved ?? d.qtyRequested
        // If product has gramasi info, multiply; otherwise store as-is (backward compat)
        const qtyToStore = prod?.gramasiPerUnit && prod.gramasiPerUnit > 0
          ? qtyKemasan * prod.gramasiPerUnit
          : qtyKemasan
        return {
          userId: req.foId,
          productId: d.productId,
          transactionType: 'STOCK_IN_GUDANG',
          quantity: qtyToStore,
          referenceId: req.id,
          notes: `Approval Pengadaan Stok oleh SPV (${qtyKemasan} ${prod?.unit ?? ''}${prod?.gramasiPerUnit ? ` = ${qtyToStore}${prod.unitGramasi ?? ''}` : ''}). Ref: ${req.plan}`,
        }
      })
    })

    // 3. Notify AFA (the requester)
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Pengajuan Stok Disetujui',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0,8).toUpperCase()}) telah disetujui oleh SPV dan stok telah masuk ke ledger Anda.`,
        link: `/dashboard/stock`
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveAfaStockRequest error:', err)
    return { error: 'Gagal menyetujui pengajuan stok AFA.' }
  }
}
