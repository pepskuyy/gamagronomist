'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { lockUserStock } from '@/lib/ledger/stock'


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

      // 2. Hitung ulang selisih terhadap saldo SAAT DISETUJUI. Selisih yang disimpan saat opname
      //    diajukan bisa basi bila ada transaksi di antaranya (pemakaian demplot, terima stok),
      //    dan menerapkannya apa adanya membuat saldo akhir ≠ stok fisik yang dihitung.
      await lockUserStock(tx, opname.userId)
      const sums = await tx.ledger.groupBy({
        by: ['productId'],
        where: { userId: opname.userId, productId: { in: opname.details.map(d => d.productId) } },
        _sum: { quantity: true },
      })
      const balance = new Map(sums.map(s => [s.productId, s._sum.quantity ?? 0]))

      for (const count of opname.details) {
        const current = balance.get(count.productId) ?? 0
        // Bulatkan agar sisa pecahan floating point (mis. 4.5e-13) tidak jadi baris penyesuaian
        const variance = Math.round((count.physicalStock - current) * 1e6) / 1e6
        if (current !== count.systemStock || variance !== count.variance) {
          await tx.opnameDetail.update({ where: { id: count.id }, data: { systemStock: current, variance } })
        }
        if (variance !== 0) {
          const txType = variance > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS'
          const stale = current !== count.systemStock
            ? ` — saldo sistem berubah dari ${count.systemStock} menjadi ${current} sejak opname diajukan`
            : ''
          await tx.ledger.create({
            data: {
              userId: opname.userId,
              productId: count.productId,
              transactionType: txType,
              quantity: variance,
              referenceId: opname.id,
              snapshotAreaId: opname.user.areaId ?? null,
              notes: `Adjustment via Opname Approved by SPV (${session.name})${stale}`
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
