'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { transferAfaToFo } from '@/lib/ledger/stock'


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
      include: { details: true, fo: true }
    })

    if (!request || request.status !== 'SUBMITTED') {
       return { error: 'Pengajuan tidak valid atau sudah diproses' }
    }

    // Eksekusi ledger transaction per detail
    for (const detail of request.details) {
      // Use AFA-adjusted qty if provided, otherwise fallback to requested qty
      const qtyToApprove = approvedQties[detail.id] ?? detail.qtyRequested
      
      if (qtyToApprove <= 0) continue // skip items with 0 qty

      // Potong stok AFA & Kirim ke FO
      await transferAfaToFo(
        session.userId, 
        request.foId, 
        detail.productId, 
        qtyToApprove,
        request.id,
        session.areaId ?? null
      )
      
      // Update approved qty di table RequestDetail
      await prisma.requestDetail.update({
        where: { id: detail.id },
        data: { qtyApproved: qtyToApprove }
      })
    }

    // Update status request + catatan approval
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        ...(approveNotes ? { problem: approveNotes } : {}), // reuse 'problem' field as approve notes
      }
    })

    // Build detail message for FO
    const detailLines = request.details.map(d => {
      const approved = approvedQties[d.id] ?? d.qtyRequested
      const diff = approved !== d.qtyRequested ? ` (diminta: ${d.qtyRequested})` : ''
      return `• ${d.productId.slice(0, 6)}… → ${approved}${diff}`
    }).join('\n')

    // Notify FO
    await prisma.notification.create({
      data: {
        userId: request.foId,
        title: '✅ Permintaan Stok Disetujui',
        message: `Permintaan stok Anda (ID: ${requestId.slice(0,8).toUpperCase()}) telah disetujui oleh AFA.${approveNotes ? `\nCatatan: ${approveNotes}` : ''}`,
        link: `/dashboard/demoplot/detail/${requestId}`
      }
    })

    return { success: true }
  } catch (err: any) {
    console.error('Approve error', err)
    return { error: 'Gagal memproses approval. Pastikan stok cukup.' }
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

    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
      }
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
    return { error: 'Gagal menolak pengajuan' }
  }
}
