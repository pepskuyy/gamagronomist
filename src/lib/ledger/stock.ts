import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Mendapatkan Daftar Saldo (Stock On-Hand) untuk User Tertentu
 * Ini dihitung dengan cara menjumlahkan field "quantity" per product di Ledger
 */
export async function getStockBalance(userId: string, opts: { includeNegative?: boolean } = {}) {
  const ledgers = await prisma.ledger.groupBy({
    by: ['productId'],
    where: { userId },
    _sum: { quantity: true }
  })

  if (ledgers.length === 0) return []

  // Hanya ambil produk yang benar-benar ada di ledger user ini (bukan semua produk)
  const productIds = ledgers.map(l => l.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }
  })

  const productMap = new Map(products.map(p => [p.id, p]))

  return ledgers
    .map(l => ({
      product: productMap.get(l.productId)!,
      quantity: l._sum.quantity || 0
    }))
    .filter(item => item.product && (
      opts.includeNegative
        ? Math.abs(item.quantity) > 0.0001   // tampilkan saldo minus (untuk monitoring ADMIN/SPV)
        : item.quantity > 0
    ))
}

/**
 * Mencatat transaksi masuk ke Gudang AFA
 */
export async function insertStockInGudang(afaId: string, productId: string, qty: number, notes?: string, areaId?: string | null) {
  return await prisma.ledger.create({
    data: {
      userId: afaId,
      productId,
      transactionType: 'STOCK_IN_GUDANG',
      quantity: qty,
      snapshotAreaId: areaId ?? null,
      notes: notes || 'Masuk dari Gudang Pusat'
    }
  })
}

type LedgerDb = Prisma.TransactionClient | typeof prisma

/**
 * Tulis pasangan baris transfer AFA → FO (TRANSFER_TO_FO −, RECEIVE_FROM_AFA +) memakai
 * client transaksi pemanggil, supaya seluruh approval bisa atomik.
 */
export async function writeAfaToFoTransfer(
  db: LedgerDb,
  t: { afaId: string; foId: string; afaName: string; foName: string; productId: string; qty: number; requestId?: string; areaId: string | null }
) {
  await db.ledger.create({
    data: {
      userId: t.afaId,
      productId: t.productId,
      transactionType: 'TRANSFER_TO_FO',
      quantity: -t.qty,
      referenceId: t.requestId,
      snapshotAreaId: t.areaId,
      notes: `Transfer ke FO: ${t.foName}`,
    },
  })
  await db.ledger.create({
    data: {
      userId: t.foId,
      productId: t.productId,
      transactionType: 'RECEIVE_FROM_AFA',
      quantity: t.qty,
      referenceId: t.requestId,
      snapshotAreaId: t.areaId,
      notes: `Terima dari AFA: ${t.afaName}`,
    },
  })
}

/**
 * Transfer Stok AFA ke FO (Ini akan memotong saldo AFA, dan menambah saldo FO)
 */
export async function transferAfaToFo(afaId: string, foId: string, productId: string, qty: number, requestId?: string, areaId?: string | null) {
  const [afa, fo] = await Promise.all([
    prisma.user.findUnique({ where: { id: afaId }, select: { name: true, areaId: true } }),
    prisma.user.findUnique({ where: { id: foId },  select: { name: true } }),
  ])
  return prisma.$transaction((tx) => writeAfaToFoTransfer(tx, {
    afaId, foId, productId, qty, requestId,
    afaName: afa?.name || afaId,
    foName: fo?.name || foId,
    // Use provided areaId, or fallback to AFA's current area
    areaId: areaId ?? afa?.areaId ?? null,
  }))
}
