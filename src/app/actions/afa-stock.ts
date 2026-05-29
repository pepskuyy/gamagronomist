/**
 * Tujuan     : Server Actions untuk seluruh workflow pengajuan restock AFA (4-step approval)
 * Caller     : UI /dashboard/stock, AfaStockRequestTable.tsx
 * Dependensi : lib/prisma, lib/accurate (createSalesInvoice), lib/waha, lib/retry
 * Main Functions: submitAfaStockRequest, approveSpv/Fam/WhmStockRequest, receiveSpvStockRequest, rejectAfaStockRequest
 * Side Effects  : DB write (Ledger, Request, Notification), HTTP POST ke Accurate, WA via WAHA
 */
'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createSalesInvoice, fetchItemPrices } from '@/lib/accurate'
import { sendWhatsAppBulk, getRolePhones, getMsgTemplate } from '@/lib/waha'
import { withRetry } from '@/lib/retry'


// ─── AFA submits a stock request ──────────────────────────────────
export async function submitAfaStockRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['AFA', 'PLANTATION', 'BD'].includes(session?.role as string)) {
    return { error: 'Hanya AFA/BD/PLANTATION yang dapat mengajukan permintaan stok masuk.' }
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

      const isBD = session.role === 'BD'
      const notifTitle = isBD
        ? '📩 Pengajuan Stok Baru (BD)'
        : '📩 Pengajuan Stok Baru (AFA)'
      const notifMsg = isBD
        ? `${afaUser?.name || 'BD'} (Busdev) telah mengajukan permintaan sampel dari gudang SPV.`
        : `${afaUser?.name || 'AFA'} telah mengajukan permintaan restock gudang AFA.`

      for (const spv of spvs) {
        await prisma.notification.create({
          data: {
            userId: spv.id,
            title: notifTitle,
            message: notifMsg,
            link: `/dashboard/stock`
          }
        })
      }

      // Send WA to SPV numbers in SystemConfig
      const spvPhones = await getRolePhones('wa_spv')
      if (spvPhones.length > 0) {
        const msgKey = isBD ? 'msg_afa_submit' : 'msg_afa_submit'
        const msg = await getMsgTemplate(msgKey, { nama_afa: afaUser?.name || (isBD ? 'BD' : 'AFA'), catatan_afa: notes })
        await sendWhatsAppBulk(spvPhones, msg)
      }

      console.log(`[${isBD ? 'BD' : 'AFA'} Stock] Notified ${spvs.length} SPV(s) for request ${req.id}`)
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
        details: { include: { product: { select: { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } } },
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

      // Get current sample balances for this SPV — include product name for fallback matching
      const sampleLedgers = await prisma.sampleLedger.findMany({
        where: { userId: spvId },
        include: { product: { select: { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } },
      })
      const balanceMap = new Map<string, number>()
      // nameToSampleId: fallback for legacy requests that stored Accurate productId instead of SMPL- id
      const nameToSampleId = new Map<string, string>() // productName -> SMPL- productId
      // productInfoMap: productId -> gramasi details (for converting kemasan to gramasi on AFA ledger credit)
      const productInfoMap = new Map<string, { gramasiPerUnit: number | null, unitGramasi: string | null, unit: string }>()
      for (const l of sampleLedgers) {
        balanceMap.set(l.productId, (balanceMap.get(l.productId) ?? 0) + l.quantity)
        // Keep track of first SMPL- product for each name (prefer positive balance)
        const existing = nameToSampleId.get(l.product.name)
        if (!existing) nameToSampleId.set(l.product.name, l.productId)
        if (!productInfoMap.has(l.productId)) {
          productInfoMap.set(l.productId, {
            gramasiPerUnit: (l.product as any).gramasiPerUnit ?? null,
            unitGramasi: (l.product as any).unitGramasi ?? null,
            unit: l.product.unit,
          })
        }
      }

      // productIdRemap: originalId -> effectiveId (for deduction step)
      const productIdRemap = new Map<string, string>()

      // Validate all items — collect ALL insufficient items first, with name-based fallback
      const insufficient: string[] = []
      for (const detail of req.details) {
        let available = balanceMap.get(detail.productId) ?? 0
        let effectiveId = detail.productId

        // Fallback: if exact ID has no stock, try to match by product name (legacy requests)
        if (available === 0) {
          const prod = (detail as any).product
          if (prod?.name) {
            const altId = nameToSampleId.get(prod.name)
            if (altId && altId !== detail.productId) {
              const altBalance = balanceMap.get(altId) ?? 0
              if (altBalance > 0) {
                available = altBalance
                effectiveId = altId
                console.log(`[Sample Approval] Remapped ${prod.name}: ${detail.productId} → ${altId} (legacy fix)`)
              }
            }
          }
        }

        productIdRemap.set(detail.productId, effectiveId)

        if (available < detail.qtyRequested) {
          const prod = (detail as any).product
          const productName = prod?.name ?? detail.productId
          const unit = prod?.unit ?? ''
          const volumeLabel = prod?.gramasiPerUnit && prod?.unitGramasi
            ? ` ${prod.gramasiPerUnit}${prod.unitGramasi}/${unit}`
            : ''
          insufficient.push(
            `• ${productName}${volumeLabel}: tersedia ${available} ${unit}, diminta ${detail.qtyRequested} ${unit}`
          )
        }
      }
      if (insufficient.length > 0) {
        return { error: `Stok sampel tidak mencukupi untuk produk berikut:\n${insufficient.join('\n')}` }
      }

      // Deduct SampleLedger + update request → APPROVED in one transaction
      await prisma.$transaction(async (tx) => {
        // Deduct each product from sample ledger (use remapped productId for legacy requests)
        for (const detail of req.details) {
          const effectiveProductId = productIdRemap.get(detail.productId) ?? detail.productId
          const requesterLabel = req.fo?.role === 'BD'
            ? `BD ${req.fo?.name || ''}`
            : `AFA ${req.fo?.name || ''}`
          await tx.sampleLedger.create({
            data: {
              userId: spvId,
              productId: effectiveProductId,
              quantity: -detail.qtyRequested,
              transactionType: 'SAMPLE_OUT',
              referenceId: requestId,
              notes: `Sampel ke ${requesterLabel} (req ${requestId.slice(0, 8).toUpperCase()})`,
            }
          })
          // Credit to requester ledger in GRAMASI units
          // prodInfo comes from sampleLedger (SMPL- product) — fallback to detail.product if not found
          const prodInfo = productInfoMap.get(effectiveProductId)
          const qtyKemasan = detail.qtyApproved ?? detail.qtyRequested
          // Prefer prodInfo.gramasiPerUnit (from SMPL- product), fallback to detail.product.gramasiPerUnit
          const gramasiPerUnit = prodInfo?.gramasiPerUnit
            ?? (detail as any).product?.gramasiPerUnit
            ?? null
          const unitGramasi = prodInfo?.unitGramasi
            ?? (detail as any).product?.unitGramasi
            ?? null
          const unit = prodInfo?.unit ?? (detail as any).product?.unit ?? ''
          const qtyGramasi = gramasiPerUnit && gramasiPerUnit > 0
            ? qtyKemasan * gramasiPerUnit
            : qtyKemasan
          await tx.ledger.create({
            data: {
              userId: req.foId,
              productId: effectiveProductId,
              transactionType: 'RECEIVE_FROM_AFA',
              quantity: qtyGramasi,
              referenceId: requestId,
              notes: `Terima sampel dari SPV (${qtyKemasan} ${unit}${gramasiPerUnit ? ` = ${qtyGramasi}${unitGramasi ?? ''}` : ''})`,
            }
          })
        }

        // Update request: APPROVED directly, record which SPV approved
        await tx.request.update({
          where: { id: requestId },
          data: { status: 'APPROVED', afaId: session.userId },
        })
      })

      // Notify requester (BD or AFA)
      const isBDReq = req.fo?.role === 'BD'
      await prisma.notification.create({
        data: {
          userId: req.foId,
          title: isBDReq
            ? '📦 Pengajuan Stok BD Disetujui — Sampel Siap'
            : '🧪 Sampel Disetujui SPV — Stok Masuk',
          message: isBDReq
            ? `Pengajuan sampel Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui SPV. Produk sampel siap untuk kegiatan Busdev Anda.`
            : `Pengajuan sampel Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) telah disetujui SPV. Stok sampel sudah masuk ke gudang Anda.`,
          link: isBDReq ? `/dashboard/stock/bd-request` : `/dashboard/stock`,
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
      const msg = await getMsgTemplate('msg_spv_approve', { nama_afa: req.fo?.name || 'AFA', catatan_afa: req.plan ?? '' })
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
      include: {
        details: {
          include: {
            product: { select: { id: true, name: true, accurateId: true, unit: true } }
          }
        },
        fo: true
      }
    })

    if (!req || req.commodity !== 'AFA_STOCK_IN') {
      return { error: 'Pengajuan stok tidak ditemukan.' }
    }
    if (req.status !== 'APPROVED_SPV') {
      return { error: 'Pengajuan ini tidak dalam status menunggu FA Manager.' }
    }

    // ── Cek stok Accurate sebelum approve ─────────────────────────────
    // availableToSell = stok tersedia SETELAH dikurangi pending SO di Accurate
    // Jika qty yang diminta AFA > availableToSell, ada risiko konflik dengan SO yang ada
    let stockWarnings: string[] = []
    try {
      const itemNos = req.details
        .map(d => (d as any).product?.accurateId)
        .filter(Boolean) as string[]

      if (itemNos.length > 0) {
        const { fetchAccurateStockLevels } = await import('@/lib/accurate')
        const stockMap = await fetchAccurateStockLevels(itemNos)

        for (const detail of req.details) {
          const d = detail as any
          const itemNo = d.product?.accurateId
          if (!itemNo) continue
          const available = stockMap.get(itemNo) ?? null
          if (available !== null && available < detail.qtyRequested) {
            stockWarnings.push(
              `• ${d.product.name}: stok tersedia (non-SO) ${available} ${d.product.unit}, diminta ${detail.qtyRequested} ${d.product.unit}`
            )
          }
        }
      }
    } catch (stockErr) {
      console.warn('[FAM Approve] Gagal cek stok Accurate (non-blocking):', stockErr)
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
      const msg = await getMsgTemplate('msg_fam_approve', { nama_afa: req.fo?.name || 'AFA', catatan_afa: req.plan ?? '' })
      await sendWhatsAppBulk(whmPhones, msg)
    }

    revalidatePath('/dashboard/stock')
    return {
      success: true,
      // stockWarnings: array of conflict messages (empty = aman)
      // FAM tetap bisa approve, tapi UI harus menampilkan warning ini
      stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
    }
  } catch (err: any) {
    console.error('approveFamStockRequest error:', err)
    return { error: 'Gagal memproses approval FA Manager.' }
  }
}

// ─── STEP 3: WH Manager approves → APPROVED_WHM + INVOICE ──────────
export async function approveWhmStockRequest(
  requestId: string,
  qtyApprovedMap?: Record<string, number>   // detailId → qtyApproved (WHM input)
) {
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

    // ── Simpan qtyApproved per detail jika WHM memberikan qty ──────────────
    if (qtyApprovedMap && Object.keys(qtyApprovedMap).length > 0) {
      await Promise.all(
        req.details.map(d => {
          const approved = qtyApprovedMap[d.id]
          if (approved !== undefined && approved >= 0) {
            return prisma.requestDetail.update({
              where: { id: d.id },
              data: { qtyApproved: approved },
            })
          }
          return Promise.resolve()
        })
      )
      // Re-fetch dengan qtyApproved terbaru
      const updated = await prisma.requestDetail.findMany({ where: { requestId } })
      req.details.splice(0, req.details.length, ...updated)
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
        // ── Fetch harga CJ R2 per item sebelum buat invoice ────────────
        // Accurate tidak otomatis apply priceLevelName via API — harga harus dikirim eksplisit
        const priceMap = await fetchItemPrices(itemCodes, 'CJ R2')
        console.log(`[WHM Approve] Price lookup CJ R2:`, Object.fromEntries(priceMap))

        const invoiceItems = req.details
          .map(d => {
            const prod = productMap.get(d.productId)
            if (!prod?.accurateId) return null
            const qtyFinal = d.qtyApproved ?? d.qtyRequested
            if (qtyFinal <= 0) return null   // skip produk yang qty-nya 0
            const unitPrice = priceMap.get(prod.accurateId) ?? 0
            return {
              itemNo:    prod.accurateId,
              quantity:  qtyFinal,
              unitPrice: unitPrice > 0 ? unitPrice : undefined,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (invoiceItems.length > 0) {
          const now = new Date()
          const transDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

          // BLOCKING: retry hingga 3x, jika gagal lempar error dan blokir WHM approval
          const invoiceResult = await withRetry(
            () => createSalesInvoice(
              'T/027',
              transDate,
              invoiceItems,
              `Diajukan untuk kebutuhan ${req.fo?.name ?? 'AFA'} — Ref: ${requestId.slice(0, 8).toUpperCase()}`,
              'Kantor Pusat SMG',
              'Gudang Baik',
              'CJ R2'
            ).then(r => {
              if (!r.success) throw new Error(r.error ?? 'Accurate API returned failure')
              return r
            }),
            { maxAttempts: 3, initialDelayMs: 1000, label: 'Accurate createSalesInvoice' }
          )

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
    } catch (accErr: any) {
      console.error('[WHM Approve] Accurate API error (BLOCKING — approval dibatalkan):', accErr.message)
      return { error: `Gagal membuat invoice di Accurate: ${accErr.message}. Coba lagi dalam beberapa menit.` }
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

    // Notify AFA with approved quantities detail
    const invoiceInfo = savedInvoiceNo ? ` Invoice Accurate: ${savedInvoiceNo}.` : ''
    const productDetails = await prisma.product.findMany({
      where: { id: { in: req.details.map(d => d.productId) } },
      select: { id: true, name: true, unit: true }
    })
    const prodNameMap = new Map(productDetails.map(p => [p.id, p]))
    const qtyDetailMsg = req.details
      .map(d => {
        const p = prodNameMap.get(d.productId)
        const qtyFinal = d.qtyApproved ?? d.qtyRequested
        const isDiff = d.qtyApproved !== null && d.qtyApproved !== d.qtyRequested
        return `• ${p?.name ?? d.productId}: ${qtyFinal} ${p?.unit ?? ''}${isDiff ? ` (diminta: ${d.qtyRequested})` : ''}`
      })
      .join('\n')
    await prisma.notification.create({
      data: {
        userId: req.foId,
        title: '✅ Disetujui WH Manager — Menunggu Penerimaan SPV',
        message: `Pengajuan stok Anda (ID: ${requestId.slice(0, 8).toUpperCase()}) disetujui WHM.\n\nKuantitas final:\n${qtyDetailMsg}${invoiceInfo}`,
        link: `/dashboard/stock`
      }
    })

    // WA: notify SPV numbers (to confirm receive)
    const spvPhonesWhm = await getRolePhones('wa_spv')
    if (spvPhonesWhm.length > 0) {
      const msg = await getMsgTemplate('msg_whm_approve', { nama_afa: req.fo?.name || 'AFA', catatan_afa: req.plan ?? '' })
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

    // Pre-fetch data sebelum transaction agar tidak ada query di dalam transaction
    const productIds = req.details.map(d => d.productId)
    const [productInfos, afaUser] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, accurateId: true, gramasiPerUnit: true, unitGramasi: true, unit: true },
      }),
      prisma.user.findUnique({
        where: { id: req.foId },
        select: { areaId: true, name: true, phone: true },
      })
    ])
    const productMap = new Map(productInfos.map(p => [p.id, p]))

    const ledgerData = req.details.map(d => {
      const prod = productMap.get(d.productId)
      // qtyApproved/qtyRequested disimpan dalam satuan KEMASAN (PCS/Btl/Box)
      // Harus dikonversi ke gramasi sebelum masuk Ledger AFA
      const qtyKemasan = d.qtyApproved ?? d.qtyRequested
      const qtyGramasi = prod?.gramasiPerUnit && prod.gramasiPerUnit > 0
        ? qtyKemasan * prod.gramasiPerUnit
        : qtyKemasan
      console.log(`[SPV Receive] ${prod?.unit ?? 'unit'}: ${qtyKemasan} kemasan × ${prod?.gramasiPerUnit ?? 1} = ${qtyGramasi} ${prod?.unitGramasi ?? prod?.unit ?? ''}`)
      return {
        userId: req.foId,
        productId: d.productId,
        transactionType: 'STOCK_IN_GUDANG',
        quantity: qtyGramasi,
        referenceId: req.id,
        snapshotAreaId: afaUser?.areaId ?? null,
        notes: `Penerimaan Stok oleh SPV (${qtyKemasan} ${prod?.unit || ''} = ${qtyGramasi} ${prod?.unitGramasi || prod?.unit || ''}). Ref: ${req.plan}`,
      }
    })

    // 1 + 2: Atomic — status APPROVED + ledger masuk dalam satu transaction
    await prisma.$transaction([
      prisma.request.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      }),
      prisma.ledger.createMany({ data: ledgerData })
    ])

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

    // Fetch harga CJ R2 eksplisit untuk regenerate
    const regenPriceMap = await fetchItemPrices(itemCodes, 'CJ R2')

    const invoiceItems = req.details
      .map(d => {
        const prod = productMap2.get(d.productId)
        if (!prod?.accurateId) return null
        const unitPrice = regenPriceMap.get(prod.accurateId) ?? 0
        return {
          itemNo:    prod.accurateId,
          quantity:  d.qtyApproved ?? d.qtyRequested,
          unitPrice: unitPrice > 0 ? unitPrice : undefined,
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
      'Gudang Baik',      // Sumber gudang stok di Accurate
      'CJ R2'             // Force price category
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
