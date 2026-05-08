'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createSalesInvoice, fetchItemPrices } from '@/lib/accurate'
import { sendWhatsAppBulk, getRolePhones, getMsgTemplate } from '@/lib/waha'

const prisma = new PrismaClient()

// ─── AFA submits a stock request ──────────────────────────────────
export async function submitAfaStockRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['AFA', 'PLANTATION'].includes(session?.role as string)) {
    return { error: 'Hanya AFA yang dapat mengajukan permintaan stok masuk.' }
  }

  const notes = (formData.get('notes') as string)?.trim() || '-'
  const warehouseSource = (formData.get('warehouseSource') as string) || 'MAIN'
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
        snapshotAreaId: session.areaId ?? null,
        warehouseSource,
        details: {
          create: validProducts.map(p => ({
            productId: p.productId,
            qtyRequested: p.qtyRequested,
            qtyApproved: p.qtyRequested,
          }))
        }
      }
    })

    // Notify SPV(s) — if AFA has areaId, notify SPVs in same area + global SPVs (areaId=null)
    try {
      const afaUser = await prisma.user.findUnique({ where: { id: session.userId } })
      const spvWhere: any = { role: 'SPV', isActive: true }
      if (afaUser?.areaId) {
        spvWhere.OR = [
          { areaId: afaUser.areaId },
          { areaId: null }
        ]
      }
      const spvs = await prisma.user.findMany({ where: spvWhere, select: { id: true } })
      
      for (const spv of spvs) {
        await prisma.notification.create({
          data: {
            userId: spv.id,
            title: '📩 Pengajuan Stok Baru (AFA)',
            message: `${afaUser?.name || 'AFA'} telah mengajukan permintaan restock gudang AFA.`,
            link: `/dashboard/stock`
          }
        })
      }

      // Send WA to SPV numbers in SystemConfig
      const spvPhones = await getRolePhones('wa_spv')
      if (spvPhones.length > 0) {
        const msg = await getMsgTemplate('msg_afa_submit', { nama_afa: afaUser?.name || 'AFA' })
        await sendWhatsAppBulk(spvPhones, msg)
      }

      console.log(`[AFA Stock] Notified ${spvs.length} SPV(s) for request ${req.id}`)
    } catch (notifErr) {
      console.warn('[AFA Stock] Failed to send SPV notification:', notifErr)
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('submitAfaStockRequest error:', err)
    return { error: 'Gagal mengirim pengajuan stok.' }
  }
}

// ─── STEP 1: SPV approves ─────────────────────────────────────────
// MAIN:   → APPROVED_SPV (→ FAM → WHM → SPV final)
// SAMPLE: → APPROVED directly (deduct SampleLedger now)
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
      include: {
        details: { include: { product: { select: { name: true, unit: true } } } },
        fo: true,
      }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'SUBMITTED') {
      return { error: 'Pengajuan ini sudah pernah diproses.' }
    }

    // ── SAMPLE WAREHOUSE FLOW ────────────────────────────────────────
    if ((req as any).warehouseSource === 'SAMPLE') {
      // Validate sample stock availability per product
      const spvId = session.userId

      // Get current sample balances for this SPV
      const sampleLedgers = await prisma.sampleLedger.findMany({
        where: { userId: spvId },
        select: { productId: true, quantity: true },
      })
      const balanceMap = new Map<string, number>()
      for (const l of sampleLedgers) {
        balanceMap.set(l.productId, (balanceMap.get(l.productId) ?? 0) + l.quantity)
      }

      // Validate all items have enough balance — collect ALL insufficient items first
      const insufficient: string[] = []
      for (const detail of req.details) {
        const available = balanceMap.get(detail.productId) ?? 0
        if (available < detail.qtyRequested) {
          const productName = (detail as any).product?.name ?? detail.productId
          const unit = (detail as any).product?.unit ?? ''
          insufficient.push(
            `• ${productName}: tersedia ${available} ${unit}, diminta ${detail.qtyRequested} ${unit}`
          )
        }
      }
      if (insufficient.length > 0) {
        return { error: `Stok sampel tidak mencukupi untuk produk berikut:\n${insufficient.join('\n')}` }
      }

      // Deduct SampleLedger + update request → APPROVED in one transaction
      await prisma.$transaction(async (tx) => {
        // Deduct each product from sample ledger
        for (const detail of req.details) {
          await tx.sampleLedger.create({
            data: {
              userId: spvId,
              productId: detail.productId,
              quantity: -detail.qtyRequested,
              transactionType: 'SAMPLE_OUT',
              referenceId: requestId,
              notes: `Sampel ke AFA ${req.fo?.name || ''} (req ${requestId.slice(0, 8).toUpperCase()})`,
            }
          })
          // Credit to AFA ledger (RECEIVE_FROM_AFA)
          await tx.ledger.create({
            data: {
              userId: req.foId,
              productId: detail.productId,
              transactionType: 'RECEIVE_FROM_AFA',
              quantity: detail.qtyApproved ?? detail.qtyRequested,
              referenceId: requestId,
              notes: `Terima sampel dari SPV (Gudang Sampel)`,
            }
          })
        }

        // Update request: APPROVED directly, record which SPV approved
        await tx.request.update({
          where: { id: requestId },
          data: { status: 'APPROVED', afaId: session.userId },
        })
      })

      // Notify AFA — sampel siap
      await prisma.notification.create({
        data: {
          userId: req.foId,
          title: '🧪 Sampel Disetujui SPV — Stok Masuk',
          message: `Pengajuan sampel Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui SPV. Stok sampel sudah masuk ke gudang Anda.`,
          link: `/dashboard/stock`,
        }
      })

      revalidatePath('/dashboard/stock')
      return { success: true, warehouseSource: 'SAMPLE' }
    }

    // ── MAIN WAREHOUSE FLOW (existing) ───────────────────────────────
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

    // WA: notify FAM role numbers
    const famPhones = await getRolePhones('wa_fam')
    if (famPhones.length > 0) {
      const msg = await getMsgTemplate('msg_spv_approve', { nama_afa: req.fo?.name || 'AFA' })
      await sendWhatsAppBulk(famPhones, msg)
    }

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

    // WA: notify WHM role numbers
    const whmPhones = await getRolePhones('wa_whm')
    if (whmPhones.length > 0) {
      const msg = await getMsgTemplate('msg_fam_approve', { nama_afa: req.fo?.name || 'AFA' })
      await sendWhatsAppBulk(whmPhones, msg)
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveFamStockRequest error:', err)
    return { error: 'Gagal memproses approval FA Manager.' }
  }
}

// ─── STEP 3: WH Manager approves → APPROVED_WHM + INVOICE ──────────
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

    // Update to APPROVED_WHM
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'APPROVED_WHM' }
    })

    // ── Buat Sales Invoice di Accurate (non-blocking) ─────────────────
    // WHM approve = konfirmasi pengeluaran stok dari gudang
    let savedInvoiceNo: string | null = null
    try {
      const productIds = req.details.map(d => d.productId)
      const productInfos = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, accurateId: true },
      })
      const productMap = new Map(productInfos.map(p => [p.id, p]))

      const itemCodes = req.details
        .map(d => productMap.get(d.productId)?.accurateId)
        .filter((x): x is string => !!x)

      if (itemCodes.length > 0) {
        const priceMap = await fetchItemPrices(itemCodes)
        const invoiceItems = req.details
          .map(d => {
            const prod = productMap.get(d.productId)
            if (!prod?.accurateId) return null
            return {
              itemNo:    prod.accurateId,
              quantity:  d.qtyApproved ?? d.qtyRequested,
              unitPrice: priceMap.get(prod.accurateId) ?? undefined,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (invoiceItems.length > 0) {
          const now = new Date()
          const transDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

          const invoiceResult = await createSalesInvoice(
            'T/027',
            transDate,
            invoiceItems,
            `Diajukan untuk kebutuhan ${req.fo?.name ?? 'AFA'} — Ref: ${requestId.slice(0, 8).toUpperCase()}`,
            'Kantor Pusat SMG',
            'Gudang Baik'
          )

          if (!invoiceResult.success) {
            console.warn(`[WHM Approve] Accurate invoice failed (non-blocking): ${invoiceResult.error}`)
          } else {
            savedInvoiceNo = invoiceResult.invoiceNo ?? null
            console.log(`[WHM Approve] Accurate invoice created: ${savedInvoiceNo}`)
            if (savedInvoiceNo) {
              await prisma.request.update({
                where: { id: requestId },
                data: { accurateInvoiceNo: savedInvoiceNo },
              })
            }
          }
        }
      }
    } catch (accErr: any) {
      console.warn('[WHM Approve] Accurate API error (non-blocking):', accErr.message)
    }

    // Notify SPV(s) in the same area as AFA + global SPVs (areaId=null)
    const afaUser = await prisma.user.findUnique({ where: { id: req.foId } })
    const spvReceiveWhere: any = { role: 'SPV', isActive: true }
    if (afaUser?.areaId) {
      spvReceiveWhere.OR = [
        { areaId: afaUser.areaId },
        { areaId: null }
      ]
    }
    const spvsToNotify = await prisma.user.findMany({ where: spvReceiveWhere, select: { id: true } })
    for (const spv of spvsToNotify) {
      await prisma.notification.create({
        data: {
          userId: spv.id,
          title: '📦 Stok Siap Diterima',
          message: `Pengajuan stok AFA (${req.fo?.name || 'AFA'}) telah disetujui WH Manager. Silakan lakukan konfirmasi penerimaan.`,
          link: `/dashboard/stock`
        }
      })
    }

    // Notify AFA about progress
    const invoiceInfo = savedInvoiceNo ? ` Invoice Accurate: ${savedInvoiceNo}.` : ''
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Disetujui WH Manager — Menunggu Penerimaan SPV',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui WH Manager. Menunggu SPV konfirmasi penerimaan.${invoiceInfo}`,
        link: `/dashboard/stock`
      }
    })

    // WA: notify SPV numbers (to confirm receive)
    const spvPhonesWhm = await getRolePhones('wa_spv')
    if (spvPhonesWhm.length > 0) {
      const msg = await getMsgTemplate('msg_whm_approve', { nama_afa: req.fo?.name || 'AFA' })
      await sendWhatsAppBulk(spvPhonesWhm, msg)
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('approveWhmStockRequest error:', err)
    return { error: 'Gagal memproses approval WH Manager.' }
  }
}

// ─── STEP 4 (FINAL): SPV receives stock → APPROVED + LEDGER ──────
export async function receiveSpvStockRequest(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'SPV' && session?.role !== 'ADMIN') {
    return { error: 'Hanya SPV yang dapat mengkonfirmasi penerimaan stok.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'APPROVED_WHM') {
      return { error: 'Pengajuan ini tidak dalam status menunggu penerimaan SPV.' }
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

    const afaUser = await prisma.user.findUnique({
      where: { id: req.foId },
      select: { areaId: true, name: true, phone: true },
    })

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
          snapshotAreaId: afaUser?.areaId ?? null,
          notes: `Penerimaan Stok oleh SPV (${qtyKemasan} ${prod?.unit ?? ''}${prod?.gramasiPerUnit ? ` = ${qtyToStore}${prod.unitGramasi ?? ''}` : ''}). Ref: ${req.plan}`,
        }
      })
    })

    // 3. Notify AFA — invoice sudah dibuat di step WHM approve
    const existingInvoiceNo = (req as any).accurateInvoiceNo as string | null ?? null
    const invoiceInfo = existingInvoiceNo ? ` Invoice Accurate: ${existingInvoiceNo}.` : ''
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Pengajuan Stok Selesai — Stok Telah Masuk',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah diterima SPV. Stok telah masuk ke ledger Anda.${invoiceInfo}`,
        link: `/dashboard/stock`
      }
    })

    // WA: notify AFA
    if (afaUser?.phone) {
      const invoiceStr = existingInvoiceNo ? `\nNo. Invoice Accurate: ${existingInvoiceNo}` : ''
      const msg = await getMsgTemplate('msg_spv_receive', {
        nama_afa: afaUser.name || 'AFA',
        id_pengajuan: requestId.slice(0, 8).toUpperCase(),
        invoice: invoiceStr,
      })
      await sendWhatsAppBulk(afaUser.phone, msg).catch(e => console.warn('[WAHA] AFA notify failed:', e))
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('receiveSpvStockRequest error:', err)
    return { error: 'Gagal memproses penerimaan stok.' }
  }
}

// ─── REJECT (any approver can reject at their step) ───────────────
export async function rejectAfaStockRequest(requestId: string, rejectRole: 'SPV' | 'FAM' | 'WHM', reason?: string) {
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
      data: {
        status: 'REJECTED',
        rejectReason: reason?.trim() || null,
      }
    })

    const roleLabels: Record<string, string> = { SPV: 'SPV', FAM: 'FA Manager', WHM: 'WH Manager' }
    const reasonText = reason?.trim() ? `\nAlasan: ${reason.trim()}` : ''

    // Notify AFA
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '❌ Pengajuan Stok Ditolak',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah ditolak oleh ${roleLabels[rejectRole]}.${reasonText}`,
        link: `/dashboard/stock`
      }
    })

    // WA: notify AFA of rejection
    const afaUserReject = await prisma.user.findUnique({ where: { id: req.foId }, select: { phone: true, name: true } })
    if (afaUserReject?.phone) {
      const msg = await getMsgTemplate('msg_rejection', {
        nama_afa: afaUserReject.name || 'AFA',
        id_pengajuan: requestId.slice(0, 8).toUpperCase(),
        peran_penolak: roleLabels[rejectRole],
      })
      await sendWhatsAppBulk(afaUserReject.phone, msg).catch(e => console.warn('[WAHA] AFA reject notify failed:', e))
    }

    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err: any) {
    console.error('rejectAfaStockRequest error:', err)
    return { error: 'Gagal menolak pengajuan stok.' }
  }
}

// ─── REGENERATE: Terbitkan ulang invoice + perbaiki ledger yang gagal ─
export async function regenerateInvoice(requestId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'SPV' && session?.role !== 'ADMIN') {
    return { error: 'Hanya SPV atau Admin yang dapat menerbitkan ulang invoice.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true },
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'APPROVED') {
      return { error: 'Invoice hanya bisa di-generate ulang untuk pengajuan yang sudah SELESAI.' }
    }
    if ((req as any).accurateInvoiceNo) {
      return { error: 'Invoice sudah ada: ' + (req as any).accurateInvoiceNo }
    }

    // Cek apakah ledger entry sudah ada untuk request ini
    const existingLedger = await prisma.ledger.findFirst({
      where: { referenceId: requestId, transactionType: 'STOCK_IN_GUDANG' },
    })

    // Jika ledger belum ada, buat dulu (akibat bug afaUser)
    if (!existingLedger) {
      const productIds = req.details.map(d => d.productId)
      const productInfos = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, accurateId: true, gramasiPerUnit: true, unitGramasi: true, unit: true },
      })
      const productMap = new Map(productInfos.map(p => [p.id, p]))

      const afaUser = await prisma.user.findUnique({
        where: { id: req.foId },
        select: { areaId: true },
      })

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
            snapshotAreaId: afaUser?.areaId ?? null,
            notes: `[REGENERATE] Penerimaan Stok (${qtyKemasan} ${prod?.unit ?? ''}${prod?.gramasiPerUnit ? ` = ${qtyToStore}${prod.unitGramasi ?? ''}` : ''}). Ref: ${req.plan}`,
          }
        }),
        skipDuplicates: true,
      })

      console.log(`[REGEN] Ledger entries created for request ${requestId}`)
    }

    // Generate Accurate invoice
    const productInfos2 = await prisma.product.findMany({
      where: { id: { in: req.details.map(d => d.productId) } },
      select: { id: true, accurateId: true },
    })
    const productMap2 = new Map(productInfos2.map(p => [p.id, p]))

    const itemCodes = req.details
      .map(d => productMap2.get(d.productId)?.accurateId)
      .filter((x): x is string => !!x)

    if (itemCodes.length === 0) {
      return { error: 'Tidak ada produk dengan Accurate ID yang terhubung. Pastikan produk sudah dikonfigurasi di master data.' }
    }

    const priceMap = await fetchItemPrices(itemCodes)

    const invoiceItems = req.details
      .map(d => {
        const prod = productMap2.get(d.productId)
        if (!prod?.accurateId) return null
        return {
          itemNo: prod.accurateId,
          quantity: d.qtyApproved ?? d.qtyRequested,
          unitPrice: priceMap.get(prod.accurateId) ?? undefined,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const now = new Date()
    const transDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

    const invoiceResult = await createSalesInvoice(
      'T/027',
      transDate,
      invoiceItems,
      `[REGENERATE] Kebutuhan ${req.fo?.name ?? 'AFA'} — Ref: ${requestId.slice(0, 8).toUpperCase()}`,
      'Kantor Pusat SMG', // Cabang di Accurate
      'Gudang Baik'       // Sumber gudang stok di Accurate
    )

    if (!invoiceResult.success) {
      return { error: `Gagal membuat invoice di Accurate: ${invoiceResult.error}` }
    }

    const invoiceNo = invoiceResult.invoiceNo ?? null
    if (invoiceNo) {
      await prisma.request.update({
        where: { id: requestId },
        data: { accurateInvoiceNo: invoiceNo },
      })
    }

    revalidatePath('/dashboard/stock')
    return { success: true, invoiceNo, ledgerCreated: !existingLedger }
  } catch (err: any) {
    console.error('regenerateInvoice error:', err)
    return { error: `Gagal generate invoice: ${err.message}` }
  }
}
