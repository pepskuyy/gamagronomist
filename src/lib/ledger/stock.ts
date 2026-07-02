import prisma from '@/lib/prisma'

/**
 * Mendapatkan Daftar Saldo (Stock On-Hand) untuk User Tertentu
 * Ini dihitung dengan cara menjumlahkan field "quantity" per product di Ledger
 */
export async function getStockBalance(userId: string) {
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
    .filter(item => item.quantity > 0 && item.product)
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

/**
 * Transfer Stok AFA ke FO (Ini akan memotong saldo AFA, dan menambah saldo FO)
 */
export async function transferAfaToFo(afaId: string, foId: string, productId: string, qty: number, requestId?: string, areaId?: string | null) {
  // Fetch both user names to produce readable notes
  const [afa, fo] = await Promise.all([
    prisma.user.findUnique({ where: { id: afaId }, select: { name: true, areaId: true } }),
    prisma.user.findUnique({ where: { id: foId },  select: { name: true } }),
  ])

  const afaName = afa?.name || afaId
  const foName  = fo?.name  || foId
  // Use provided areaId, or fallback to AFA's current area
  const resolvedAreaId = areaId ?? afa?.areaId ?? null

  return await prisma.$transaction([
    // Potong stok AFA
    prisma.ledger.create({
      data: {
        userId: afaId,
        productId,
        transactionType: 'TRANSFER_TO_FO',
        quantity: -qty,
        referenceId: requestId,
        snapshotAreaId: resolvedAreaId,
        notes: `Transfer ke FO: ${foName}`
      }
    }),
    // Tambah stok FO
    prisma.ledger.create({
      data: {
        userId: foId,
        productId,
        transactionType: 'RECEIVE_FROM_AFA',
        quantity: qty,
        referenceId: requestId,
        snapshotAreaId: resolvedAreaId,
        notes: `Terima dari AFA: ${afaName}`
      }
    })
  ])
}
