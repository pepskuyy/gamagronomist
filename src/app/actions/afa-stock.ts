'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createSalesInvoice } from '@/lib/accurate'

const prisma = new PrismaClient()

// ─── AFA submits a stock request ──────────────────────────────────
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
        foId: session.userId,
        commodity: 'AFA_STOCK_IN',
        plan: notes,
        status: 'SUBMITTED',
        details: {
          create: validProducts.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
            qtyApproved: p.qtyRequested,
          }))
        }
      }
    })

    // Notify SPV(s) in the same area
    const afaUser = await prisma.user.findUnique({ where: { id: session.userId } })
    if (afaUser && afaUser.areaId) {
      const spvs = await prisma.user.findMany({ where: { role: 'SPV', areaId: afaUser.areaId } })
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

// ─── STEP 1: SPV approves → APPROVED_SPV ──────────────────────────
export async function approveAfaStockRequest(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'SPV' && session?.role !== 'ADMIN') {
    return { error: 'Hanya SPV yang dapat menyetujui pada tahap ini.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'SUBMITTED') {
      return { error: 'Pengajuan ini sudah pernah diproses.' }
    }

    // Update to APPROVED_SPV — no ledger entry yet
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED_SPV',
        afaId: session.userId,
      }
    })

    // Notify all FA Managers
    const fams = await prisma.user.findMany({ where: { role: 'FAM', isActive: true } })
    for (const fam of fams) {
      await prisma.notification.create({
        data: {
          userId: fam.id,
          title: '📩 Pengajuan Stok Menunggu Approval FA Manager',
          message: `Pengajuan stok AFA (${req.fo?.name || 'AFA'}) telah disetujui SPV dan menunggu approval Anda.`,
          link: `/dashboard/stock`
        }
      })
    }

    // Notify AFA about progress
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Disetujui SPV — Menunggu FA Manager',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui SPV. Menunggu approval FA Manager.`,
        link: `/dashboard/stock`
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveAfaStockRequest error:', err)
    return { error: 'Gagal memproses approval SPV.' }
  }
}

// ─── STEP 2: FA Manager approves → APPROVED_FAM ───────────────────
export async function approveFamStockRequest(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'FAM') {
    return { error: 'Hanya FA Manager yang dapat menyetujui pada tahap ini.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'APPROVED_SPV') {
      return { error: 'Pengajuan ini tidak dalam status menunggu FA Manager.' }
    }

    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'APPROVED_FAM' }
    })

    // Notify all WH Managers
    const whms = await prisma.user.findMany({ where: { role: 'WHM', isActive: true } })
    for (const whm of whms) {
      await prisma.notification.create({
        data: {
          userId: whm.id,
          title: '📩 Pengajuan Stok Menunggu Approval WH Manager',
          message: `Pengajuan stok AFA (${req.fo?.name || 'AFA'}) telah disetujui FA Manager dan menunggu approval Anda.`,
          link: `/dashboard/stock`
        }
      })
    }

    // Notify AFA about progress
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Disetujui FA Manager — Menunggu WH Manager',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui FA Manager. Menunggu approval WH Manager.`,
        link: `/dashboard/stock`
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveFamStockRequest error:', err)
    return { error: 'Gagal memproses approval FA Manager.' }
  }
}

// ─── STEP 3 (FINAL): WH Manager approves → APPROVED + LEDGER ─────
export async function approveWhmStockRequest(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'WHM') {
    return { error: 'Hanya WH Manager yang dapat menyetujui pada tahap ini.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'APPROVED_FAM') {
      return { error: 'Pengajuan ini tidak dalam status menunggu WH Manager.' }
    }

    // 1. Update to APPROVED (final)
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    })

    // 2. Add stock to AFA's ledger (with gramasi conversion)
    const productIds = req.details.map(d => d.productId)
    const productInfos = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, accurateId: true, gramasiPerUnit: true, unitGramasi: true, unit: true },
    })
    const productMap = new Map(productInfos.map(p => [p.id, p]))

    await prisma.ledger.createMany({
      data: req.details.map(d => {
        const prod = productMap.get(d.productId)
        const qtyKemasan = d.qtyApproved ?? d.qtyRequested
        const qtyToStore = prod?.gramasiPerUnit && prod.gramasiPerUnit > 0
          ? qtyKemasan * prod.gramasiPerUnit
          : qtyKemasan
        return {
          userId: req.foId,
          productId: d.productId,
          transactionType: 'STOCK_IN_GUDANG',
          quantity: qtyToStore,
          referenceId: req.id,
          notes: `Approval Pengadaan Stok oleh WH Manager (${qtyKemasan} ${prod?.unit ?? ''}${prod?.gramasiPerUnit ? ` = ${qtyToStore}${prod.unitGramasi ?? ''}` : ''}). Ref: ${req.plan}`,
        }
      })
    })

    // 3. Create Sales Invoice in Accurate (outbound from warehouse)
    //    Non-blocking: approval succeeds even if Accurate API is unreachable
    try {
      const invoiceItems = req.details
        .map(d => {
          const prod = productMap.get(d.productId)
          if (!prod?.accurateId) return null
          return {
            itemNo: prod.accurateId,
            quantity: d.qtyApproved ?? d.qtyRequested,
            unitPrice: 0, // Internal transfer, no sales value
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      if (invoiceItems.length > 0) {
        const now = new Date()
        const transDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
        const afaName = req.fo?.name ?? 'AFA'

        const invoiceResult = await createSalesInvoice(
          'PT Gama Agro Sejati',
          transDate,
          invoiceItems,
          `Pengadaan Stok AFA (${afaName}) — Ref: ${requestId.slice(0, 8).toUpperCase()}`
        )

        if (!invoiceResult.success) {
          console.warn(`[WHM Approve] Accurate invoice creation failed (non-blocking): ${invoiceResult.error}`)
        } else {
          console.log(`[WHM Approve] Accurate invoice created: ${invoiceResult.invoiceNo}`)
        }
      }
    } catch (accErr: any) {
      console.warn(`[WHM Approve] Accurate API error (non-blocking):`, accErr.message)
    }

    // 4. Notify AFA (requester) — final
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Pengajuan Stok Selesai — Stok Telah Masuk',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui WH Manager. Stok telah masuk ke ledger Anda.`,
        link: `/dashboard/stock`
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveWhmStockRequest error:', err)
    return { error: 'Gagal memproses approval WH Manager.' }
  }
}

// ─── REJECT (any approver can reject at their step) ───────────────
export async function rejectAfaStockRequest(requestId: string, rejectRole: 'SPV' | 'FAM' | 'WHM') {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  const roleStatusMap: Record<string, string> = {
    'SPV': 'SUBMITTED',
    'FAM': 'APPROVED_SPV',
    'WHM': 'APPROVED_FAM',
  }

  if (session?.role !== rejectRole && session?.role !== 'ADMIN') {
    return { error: 'Anda tidak memiliki akses untuk menolak pada tahap ini.' }
  }

  const expectedStatus = roleStatusMap[rejectRole]
  if (!expectedStatus) return { error: 'Role tidak valid.' }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { fo: true }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== expectedStatus) {
      return { error: 'Pengajuan ini tidak dalam status yang sesuai untuk ditolak.' }
    }

    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })

    const roleLabels: Record<string, string> = { SPV: 'SPV', FAM: 'FA Manager', WHM: 'WH Manager' }

    // Notify AFA
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '❌ Pengajuan Stok Ditolak',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah ditolak oleh ${roleLabels[rejectRole]}.`,
        link: `/dashboard/stock`
      }
    })

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('rejectAfaStockRequest error:', err)
    return { error: 'Gagal menolak pengajuan stok.' }
  }
}
