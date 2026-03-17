import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Mendapatkan Daftar Saldo (Stock On-Hand) untuk User Tertentu
 * Ini dihitung dengan cara menjumlahkan field "quantity" per product di Ledger
 */
export async function getStockBalance(userId: string) {
  const ledgers = await prisma.ledger.groupBy({
    by: ['productId'],
    where: { userId },
    _sum: {
      quantity: true
    }
  })

  // get product metadata
  const products = await prisma.product.findMany()

  const balance = products.map(product => {
    const stockAgg = ledgers.find(l => l.productId === product.id)
    return {
      product,
      quantity: stockAgg?._sum.quantity || 0
    }
  })

  return balance.filter(item => item.quantity > 0)
}

/**
 * Mencatat transaksi masuk ke Gudang AFA
 */
export async function insertStockInGudang(afaId: string, productId: string, qty: number, notes?: string) {
  return await prisma.ledger.create({
    data: {
      userId: afaId,
      productId,
      transactionType: 'STOCK_IN_GUDANG',
      quantity: qty, // Positif
      notes: notes || 'Masuk dari Gudang Pusat'
    }
  })
}

/**
 * Transfer Stok AFA ke FO (Ini akan memotong saldo AFA, dan menambah saldo FO)
 */
export async function transferAfaToFo(afaId: string, foId: string, productId: string, qty: number, requestId?: string) {
  return await prisma.$transaction([
    // Potong stok AFA
    prisma.ledger.create({
      data: {
        userId: afaId,
        productId,
        transactionType: 'TRANSFER_TO_FO',
        quantity: -qty, // Negatif
        referenceId: requestId,
        notes: `Transfer ke FO ${foId}`
      }
    }),
    // Tambah stok FO
    prisma.ledger.create({
      data: {
        userId: foId,
        productId,
        transactionType: 'RECEIVE_FROM_AFA',
        quantity: qty, // Positif
        referenceId: requestId,
        notes: `Terima dari AFA ${afaId}`
      }
    })
  ])
}
