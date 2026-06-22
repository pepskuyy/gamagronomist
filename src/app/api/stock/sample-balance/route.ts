import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/stock/sample-balance?requestId=[id]
 * Digunakan oleh SPV modal untuk menampilkan saldo SampleLedger per produk
 * sebelum melakukan partial approval pengajuan sampel dari AFA/BD.
 * Return: per-item { detailId, productId, productName, unit, available, qtyRequested }
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestId = req.nextUrl.searchParams.get('requestId')
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  // Load the request with its details
  const stockRequest = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      details: {
        include: {
          product: {
            select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true }
          }
        }
      }
    }
  })

  if (!stockRequest) {
    return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 })
  }

  // Get current sample stock balance for this SPV
  const sampleLedgers = await prisma.sampleLedger.findMany({
    where: { userId: session.userId },
    select: { productId: true, quantity: true, product: { select: { name: true } } }
  })

  // Build balance map: productId → balance
  const balanceMap = new Map<string, number>()
  const nameToId = new Map<string, string>() // productName → productId (for legacy remap)
  for (const l of sampleLedgers) {
    balanceMap.set(l.productId, (balanceMap.get(l.productId) ?? 0) + l.quantity)
    if (!nameToId.has(l.product.name)) nameToId.set(l.product.name, l.productId)
  }

  // Build result per detail item
  const items = stockRequest.details.map(detail => {
    const prod = (detail as any).product
    let available = balanceMap.get(detail.productId) ?? 0
    let effectiveProductId = detail.productId

    // Legacy fallback: if no stock by exact ID, try by name
    if (stockRequest.warehouseSource !== 'MAIN' && available === 0 && prod?.name) {
      const altId = nameToId.get(prod.name)
      if (altId && altId !== detail.productId) {
        const altBalance = balanceMap.get(altId) ?? 0
        if (altBalance > 0) {
          available = altBalance
          effectiveProductId = altId
        }
      }
    }

    if (stockRequest.warehouseSource === 'MAIN') {
      available = 999999 // Unlimited for UI purposes, WHM will validate later
    }

    return {
      detailId: detail.id,
      productId: detail.productId,
      effectiveProductId,
      productName: prod?.name ?? detail.productId,
      unit: prod?.unit ?? '',
      gramasiPerUnit: prod?.gramasiPerUnit ?? null,
      unitGramasi: prod?.unitGramasi ?? null,
      available,
      qtyRequested: detail.qtyRequested,
      qtyApproved: detail.qtyApproved,
    }
  })

  return NextResponse.json({ items })
}
