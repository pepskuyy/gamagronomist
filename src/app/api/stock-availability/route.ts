import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateStockLevels } from '@/lib/accurate'
import prisma from '@/lib/prisma'

/**
 * GET /api/stock-availability?requestId=xxx
 *
 * Digunakan oleh WHM saat melihat pengajuan AFA.
 * Fetch availableToSell (stok net of SO) dari Accurate untuk semua produk
 * dalam request, lalu return map productId → availableToSell.
 *
 * Response:
 * {
 *   availability: [
 *     { productId, productName, unit, accurateId, availableToSell, requested, approved }
 *   ]
 * }
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only WHM can use this endpoint
  if (!['WHM', 'ADMIN'].includes(session.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const requestId = searchParams.get('requestId')
  if (!requestId) return NextResponse.json({ error: 'requestId wajib diisi' }, { status: 400 })

  try {
    const stockRequest = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        details: {
          include: {
            product: {
              select: { id: true, name: true, unit: true, accurateId: true }
            }
          }
        }
      }
    })

    if (!stockRequest) {
      return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 })
    }

    // Collect all accurateIds for batch query
    const accurateIds = stockRequest.details
      .map(d => (d as any).product?.accurateId)
      .filter(Boolean) as string[]

    // Fetch availableToSell from Accurate (batch)
    let stockMap = new Map<string, number>()
    if (accurateIds.length > 0) {
      stockMap = await fetchAccurateStockLevels(accurateIds)
    }

    const availability = stockRequest.details.map(d => {
      const prod = (d as any).product
      const accurateId = prod?.accurateId ?? null
      const availableToSell = accurateId ? (stockMap.get(accurateId) ?? null) : null

      return {
        detailId:       d.id,
        productId:      d.productId,
        productName:    prod?.name ?? '-',
        unit:           prod?.unit ?? '-',
        accurateId,
        availableToSell,          // null = not found in Accurate
        qtyRequested:   d.qtyRequested,
        qtyApproved:    d.qtyApproved ?? null,
      }
    })

    return NextResponse.json({ availability })
  } catch (err: any) {
    console.error('[stock-availability]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
