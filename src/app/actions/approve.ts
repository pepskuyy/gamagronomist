'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { writeAfaToFoTransfer, getStockBalance } from '@/lib/ledger/stock'
import { transitionRequest, requestErrorMessage } from '@/lib/request-transition'


/**
 * AFA Approve Request — with adjustable quantities per product
 *
 * formData expects:
 *   requestId          — ID pengajuan
 *   approvedQties      — JSON string: { [detailId]: number }
 *   approveNotes       — keterangan opsional dari AFA
 */
export async function approveRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['AFA', 'PLANTATION'].includes(session?.role as string) && session?.role !== 'ADMIN') {
    return { error: 'Hanya AFA yang dapat menyetujui pengajuan' }
  }

  const requestId = formData.get('requestId') as string
  if (!requestId) return { error: 'Request ID tidak ditemukan' }

  // Parse qty overrides from form
  let approvedQties: Record<string, number> = {}
  try {
    const raw = formData.get('approvedQties') as string
    if (raw) approvedQties = JSON.parse(raw)
  } catch { /* ignore parse error — use requested qty as fallback */ }

  const approveNotes = (formData.get('approveNotes') as string)?.trim() || null

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: { include: { product: true } }, fo: true }
    })

    if (!request || request.status !== 'SUBMITTED') {
       return { error: 'Pengajuan tidak valid atau sudah diproses' }
    }
    // Hanya pengajuan FO → AFA. Pengajuan restock AFA ke gudang punya alur sendiri (afa-stock.ts).
    if (request.commodity === 'AFA_STOCK_IN') {
      return { error: 'Pengajuan ini adalah restock gudang dan tidak diproses dari sini.' }
    }

    // Saldo AFA saat ini (dalam satuan ledger: gramasi bila ada, selain itu kemasan)
    const afaStocks = await getStockBalance(session.userId)
    const afaStockMap = new Map(afaStocks.map(s => [s.product.id, s.quantity]))
    const stockWarnings: string[] = []

    // 1. Hitung qty ledger per detail (belum menulis apa pun)
    const plan: Array<{ detailId: string; productId: string; qtyLedger: number; detailData: Record<string, unknown> }> = []
    for (const detail of request.details) {
      // Use AFA-adjusted qty if provided, otherwise fallback to requested qty
      const qtyInput = approvedQties[detail.id] ?? detail.qtyRequested

      if (qtyInput <= 0) continue // skip items with 0 qty

      // Normalisasi ke satuan ledger (gramasi).
      // FO normalnya mengajukan dalam gramasi (ml/gr). Namun jika requestUnit berisi satuan
      // kemasan (PCS/Btl) — mis. saat pengajuan dibuat produk belum punya data gramasi —
      // maka angka harus dikonversi: kemasan × gramasiPerUnit.
      const prod = detail.product
      const gramasi = prod?.gramasiPerUnit && prod.gramasiPerUnit > 0 ? prod.gramasiPerUnit : null
      const reqUnit = (detail.requestUnit || '').trim().toLowerCase()
      const gramUnit = (prod?.unitGramasi || '').trim().toLowerCase()
      const isKemasanInput = !!gramasi && !!reqUnit && reqUnit !== gramUnit
      const qtyLedger = isKemasanInput ? qtyInput * (gramasi as number) : qtyInput
      const displayUnit = prod?.unitGramasi || prod?.unit || ''

      // Peringatan (tidak memblokir) jika stok AFA tidak mencukupi
      const available = afaStockMap.get(detail.productId) ?? 0
      if (available < qtyLedger) {
        stockWarnings.push(`${prod?.name ?? detail.productId}: tersedia ${available} ${displayUnit}, disetujui ${qtyLedger} ${displayUnit}`)
      }
      afaStockMap.set(detail.productId, available - qtyLedger)

      plan.push({
        detailId: detail.id,
        productId: detail.productId,
        qtyLedger,
        // Simpan qty disetujui dalam satuan ledger agar konsisten dengan Ledger
        detailData: {
          qtyApproved: qtyLedger,
          ...(isKemasanInput ? {
            requestUnit: prod?.unitGramasi ?? null,
            qtyRequested: detail.qtyRequested * (gramasi as number),
          } : {}),
        },
      })
    }

    const [afaUser, foUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, areaId: true } }),
      prisma.user.findUnique({ where: { id: request.foId }, select: { name: true } }),
    ])

    // 2. Status kondisional + semua transfer + update detail dalam SATU transaksi.
    //    Klik ganda / approve bersamaan: transaksi kedua gagal di transitionRequest dan tidak menulis ledger.
    await prisma.$transaction(async (tx) => {
      await transitionRequest(tx, requestId, 'SUBMITTED', {
        status: 'APPROVED',
        ...(approveNotes ? { problem: approveNotes } : {}), // reuse 'problem' field as approve notes
      })
      for (const item of plan) {
        await writeAfaToFoTransfer(tx, {
          afaId: session.userId,
          foId: request.foId,
          afaName: afaUser?.name || session.userId,
          foName: foUser?.name || request.foId,
          productId: item.productId,
          qty: item.qtyLedger,
          requestId: request.id,
          areaId: session.areaId ?? afaUser?.areaId ?? null,
        })
        await tx.requestDetail.update({ where: { id: item.detailId }, data: item.detailData })
      }
    }, { maxWait: 5000, timeout: 30000 })

    // Notify AFA sendiri jika ada stok yang tidak mencukupi (peringatan, tidak memblokir)
    if (stockWarnings.length > 0) {
      await prisma.notification.create({
        data: {
          userId: session.userId,
          title: '⚠️ Approval Melebihi Stok',
          message: `Pengajuan ${requestId.slice(0,8).toUpperCase()} disetujui melebihi saldo stok Anda:\n${stockWarnings.join('\n')}\nSaldo Anda kini minus untuk produk tersebut. Segera lakukan opname/penyesuaian.`,
          link: '/dashboard/stock'
        }
      })
    }

    // Notify FO
    await prisma.notification.create({
      data: {
        userId: request.foId,
        title: '✅ Permintaan Stok Disetujui',
        message: `Permintaan stok Anda (ID: ${requestId.slice(0,8).toUpperCase()}) telah disetujui oleh AFA.${approveNotes ? `\nCatatan: ${approveNotes}` : ''}`,
        link: `/dashboard/demoplot/detail/${requestId}`
      }
    })

    return { success: true, warnings: stockWarnings }
  } catch (err: any) {
    console.error('Approve error', err)
    return { error: requestErrorMessage(err, 'Gagal memproses approval. Pastikan stok cukup.') }
  }
}

// AFA Reject Request — with required reason
export async function rejectRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['AFA', 'PLANTATION'].includes(session?.role as string) && session?.role !== 'ADMIN') {
    return { error: 'Akses ditolak' }
  }

  const requestId = formData.get('requestId') as string
  const reason = (formData.get('rejectReason') as string)?.trim() || null
  if (!requestId) return { error: 'Data tidak valid' }

  try {
    const request = await prisma.request.findUnique({ where: { id: requestId } })
    if (!request) return { error: 'Request tidak valid' }
    if (request.commodity === 'AFA_STOCK_IN') {
      return { error: 'Pengajuan restock gudang ditolak dari halaman stok, bukan dari sini.' }
    }
    if (request.status !== 'SUBMITTED') {
      // Setelah disetujui, stok sudah pindah ke FO; menolak sekarang membuat laporan tidak sesuai ledger.
      return { error: 'Hanya pengajuan yang belum diproses yang bisa ditolak.' }
    }

    await transitionRequest(prisma, requestId, 'SUBMITTED', {
      status: 'REJECTED',
      rejectReason: reason,
    })

    // Notify FO
    await prisma.notification.create({
      data: {
        userId: request.foId,
        title: '❌ Permintaan Stok Ditolak',
        message: `Permintaan stok Anda (ID: ${requestId.slice(0,8).toUpperCase()}) telah ditolak oleh AFA.${reason ? `\nAlasan: ${reason}` : ''}`,
        link: `/dashboard/demoplot/detail/${requestId}`
      }
    })

    return { success: true }
  } catch (err) {
    return { error: requestErrorMessage(err, 'Gagal menolak pengajuan') }
  }
}
