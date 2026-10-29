import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Pindah status Request HANYA bila status saat ini sesuai yang diharapkan.
 * Dipakai agar dua klik / dua approver bersamaan tidak sama-sama memproses
 * (dan menulis ledger dua kali). Bila status sudah berubah, lempar RequestStateError
 * sehingga transaksi pemanggil ikut dibatalkan.
 */
export class RequestStateError extends Error {
  constructor(message = 'Pengajuan ini sudah diproses oleh pengguna lain. Muat ulang halaman.') {
    super(message)
    this.name = 'RequestStateError'
  }
}

type Db = Prisma.TransactionClient | typeof prisma

export async function transitionRequest(
  db: Db,
  requestId: string,
  fromStatus: string | string[],
  data: Prisma.RequestUncheckedUpdateManyInput
) {
  const status = Array.isArray(fromStatus) ? { in: fromStatus } : fromStatus
  const res = await db.request.updateMany({ where: { id: requestId, status }, data })
  if (res.count === 0) throw new RequestStateError()
}

/** Pesan error untuk dikembalikan ke UI: pesan RequestStateError apa adanya, selain itu fallback. */
export function requestErrorMessage(err: unknown, fallback: string): string {
  return err instanceof RequestStateError ? err.message : fallback
}
