import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ledgerUnit } from '@/lib/stock-units'

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

/**
 * Cek kecukupan saldo sebelum stok dikurangi (pemakaian / transfer).
 * Qty dalam satuan ledger. Mengembalikan daftar pesan kekurangan; kosong = cukup.
 */
export async function findStockShortages(userId: string, items: Array<{ productId: string; qty: number }>): Promise<string[]> {
  const need = new Map<string, number>()
  for (const it of items) {
    if (it.qty > 0) need.set(it.productId, (need.get(it.productId) ?? 0) + it.qty)
  }
  if (need.size === 0) return []

  const productIds = Array.from(need.keys())
  const [sums, products] = await Promise.all([
    prisma.ledger.groupBy({ by: ['productId'], where: { userId, productId: { in: productIds } }, _sum: { quantity: true } }),
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } }),
  ])
  const balance = new Map(sums.map(s => [s.productId, s._sum.quantity ?? 0]))
  const productMap = new Map(products.map(p => [p.id, p]))

  const shortages: string[] = []
  for (const [productId, qty] of need) {
    const available = balance.get(productId) ?? 0
    if (qty > available + 1e-9) {
      const p = productMap.get(productId)
      const unit = p ? ledgerUnit(p) : ''
      shortages.push(`${p?.name ?? productId}: saldo ${Math.max(0, available).toLocaleString('id-ID')} ${unit}, dibutuhkan ${qty.toLocaleString('id-ID')} ${unit}`)
    }
  }
  return shortages
}

export const DEMOPLOT_USAGE_TYPES = ['USAGE_DEMOPLOT', 'DIRECT_USAGE_AFA']

/**
 * Kembalikan stok yang terpotong oleh pemakaian (saat laporan dihapus) dengan baris USAGE_REVERSAL.
 * Riwayat asli tidak dihapus. Aman dipanggil berulang: referensi yang sudah dibalik dilewati.
 */
export async function reverseUsageRows(db: LedgerDb, referenceIds: string[], usageTypes: string[], note: string) {
  if (referenceIds.length === 0) return 0
  const [rows, reversed] = await Promise.all([
    db.ledger.findMany({ where: { referenceId: { in: referenceIds }, transactionType: { in: usageTypes } } }),
    db.ledger.findMany({ where: { referenceId: { in: referenceIds }, transactionType: 'USAGE_REVERSAL' }, select: { referenceId: true } }),
  ])
  const done = new Set(reversed.map(r => r.referenceId))
  let count = 0
  for (const row of rows) {
    if (done.has(row.referenceId)) continue
    await db.ledger.create({
      data: {
        userId: row.userId,
        productId: row.productId,
        transactionType: 'USAGE_REVERSAL',
        quantity: -row.quantity,
        referenceId: row.referenceId,
        snapshotAreaId: row.snapshotAreaId,
        notes: `${note} (membalik ${row.transactionType})`,
      },
    })
    count++
  }
  return count
}

/**
 * Referensi ledger pemakaian milik satu sesi demplot. Sesi pertama demplot mandiri mencatat
 * pemakaian dengan referenceId = id request (lihat standalone-demoplot.ts), sesi lain = id demplot.
 */
export async function demoPlotUsageRefs(db: LedgerDb, dp: { id: string; requestId: string | null }) {
  const refs = [dp.id]
  if (dp.requestId) {
    const first = await db.demoPlot.findFirst({ where: { requestId: dp.requestId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    if (first?.id === dp.id) refs.push(dp.requestId)
  }
  return refs
}
