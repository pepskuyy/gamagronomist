import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateStockLevels } from '@/lib/accurate'
import prisma from '@/lib/prisma'

/**
 * GET /api/check-stock-conflict?productId=xxx&qty=10
 *
 * Real-time check: apakah qty yang diminta AFA melebihi stok yang
 * tersedia di Accurate setelah diperhitungkan pending Sales Order.
 *
 * availableToSell = stok fisik - qty terikat di SO yang open
 *
 * Response:
 *   { conflict: false, available: 20, unit: 'Btl' }
 *   { conflict: true,  available: 5,  unit: 'Btl', requested: 10, productName: '...' }
 *   { conflict: null } — jika produk tidak ada di Accurate (tidak bisa dicek)
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const qty       = parseInt(searchParams.get('qty') ?? '0', 10)

  if (!productId || qty <= 0) {
    return NextResponse.json({ error: 'productId dan qty wajib diisi' }, { status: 400 })
  }

  try {
    // Ambil accurateId dan info produk dari DB
    const product = await (prisma.product as any).findUnique({
      where: { id: productId },
      select: { id: true, name: true, unit: true, accurateId: true, spvStock: true },
    })

    if (!product?.accurateId) {
      // Produk tidak terhubung ke Accurate — tidak bisa dicek, anggap aman
      return NextResponse.json({ conflict: null, reason: 'no_accurate_id' })
    }

    // Query availableToSell real-time dari Accurate
    const stockMap = await fetchAccurateStockLevels([product.accurateId])
    const available = stockMap.get(product.accurateId) ?? null

    if (available === null) {
      // Accurate tidak mengembalikan data untuk item ini
      return NextResponse.json({ conflict: null, reason: 'not_found_in_accurate' })
    }

    const conflict = qty > available

    return NextResponse.json({
      conflict,
      available,
      requested: qty,
      productName: product.name,
      unit: product.unit,
    })
  } catch (err: any) {
    console.error('[check-stock-conflict]', err)
    // Non-blocking: jika Accurate error, jangan blokir AFA
    return NextResponse.json({ conflict: null, reason: 'accurate_error', error: err.message })
  }
}
