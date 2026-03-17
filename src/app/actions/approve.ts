'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { transferAfaToFo } from '@/lib/ledger/stock'

const prisma = new PrismaClient()

// AFA Approve Request
export async function approveRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA' && session?.role !== 'ADMIN') {
    return { error: 'Hanya AFA yang dapat menyetujui pengajuan' }
  }

  const requestId = formData.get('requestId') as string
  if (!requestId) return { error: 'Request ID tidak ditemukan' }

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { details: true, fo: true }
    })

    if (!request || request.status !== 'SUBMITTED') {
       return { error: 'Pengajuan tidak valid atau sudah diproses' }
    }
    
    // Simulasikan persetujuan untuk semua item di detail (qtyApproval = qtyRequested by default untuk MVP simple)
    // Dalam app yang lebih kompleks form ini bisa memanipulasi qtyApproved per item

    // Eksekusi ledger transaction
    for (const detail of request.details) {
      // Potong stok AFA & Kirim ke FO
      await transferAfaToFo(
        session.userId, 
        request.foId, 
        detail.productId, 
        detail.qtyRequested, // untuk saat ini approve full quantity
        request.id
      )
      
      // Update approved qty di table RequestDetail
      await prisma.requestDetail.update({
        where: { id: detail.id },
        data: { qtyApproved: detail.qtyRequested }
      })
    }

    // Update status request
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    })

    return { success: true }
  } catch (err: any) {
    console.error('Approve error', err)
    return { error: 'Gagal memproses approval. Pastikan stok cukup.' }
  }
}

// AFA Reject Request
export async function rejectRequest(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA' && session?.role !== 'ADMIN') {
    return { error: 'Akses ditolak' }
  }

  const requestId = formData.get('requestId') as string
  if (!requestId) return { error: 'Data tidak valid' }

  try {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })
    return { success: true }
  } catch (err) {
    return { error: 'Gagal menolak pengajuan' }
  }
}
