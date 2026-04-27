'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function approveStockOpname(opnameId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role as string)) {
    return { error: 'Unauthorized. Hanya SPV/ADMIN yang dapat memberikan persetujuan.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Dapatkan opname dan pastikan status masih SUBMITTED
      const opname = await tx.stockOpname.findUnique({
        where: { id: opnameId },
        include: { details: true, user: true }
      })

      if (!opname) throw new Error('Data opname tidak ditemukan.')
      if (opname.status !== 'SUBMITTED') throw new Error(`Status opname sudah ${opname.status}.`)

      // 2. Adjust Ledger berdasarkan variances dari tiap detail
      for (const count of opname.details) {
        if (count.variance !== 0) {
          const txType = count.variance > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS'
          await tx.ledger.create({
            data: {
              userId: opname.userId,
              productId: count.productId,
              transactionType: txType,
              quantity: count.variance,
              referenceId: opname.id,
              snapshotAreaId: opname.user.areaId ?? null,
              notes: `Adjustment via Opname Approved by SPV (${session.name})`
            }
          })
        }
      }

      // 3. Update status StockOpname ke APPROVED
      await tx.stockOpname.update({
        where: { id: opname.id },
        data: { status: 'APPROVED' }
      })
    })

    revalidatePath('/dashboard/opname')
    return { success: true }
  } catch (err: any) {
    console.error('Opname Approve Error:', err)
    return { error: err.message || 'Terjadi kesalahan sistem saat menyetujui Opname.' }
  }
}

export async function rejectStockOpname(opnameId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role as string)) {
    return { error: 'Unauthorized.' }
  }

  try {
    const opname = await (prisma.stockOpname as any).findUnique({
      where: { id: opnameId }
    })
    if (!opname) return { error: 'Data tidak ditemukan.' }
    if (opname.status !== 'SUBMITTED') return { error: `Sudah diproses (${opname.status})` }

    await (prisma.stockOpname as any).update({
      where: { id: opnameId },
      data: { status: 'REJECTED' }
    })

    revalidatePath('/dashboard/opname')
    return { success: true }
  } catch (err: any) {
    console.error('Opname Reject Error:', err)
    return { error: 'Kesalahan saat menolak opname.' }
  }
}
