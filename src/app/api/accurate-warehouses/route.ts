/**
 * GET /api/accurate-warehouses?productId=xxx  (resolves via DB to Accurate itemNo)
 * GET /api/accurate-warehouses?itemNo=FG-001  (direct Accurate itemNo)
 * GET /api/accurate-warehouses?itemNo=FG-001&debug=1  (return raw Accurate response)
 *
 * Fetch daftar gudang Accurate yang memiliki stok untuk item tertentu.
 * Menggunakan endpoint item/detail.do untuk mendapatkan warehouseDetail per gudang.
 *
 * Response:
 *   { warehouses: [{ name: string; qty: number }] }
 */

import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_WAREHOUSE = 'Gudang Baik'

function buildHeaders(secret: string, token: string): Record<string, string> {
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
  return {
    Authorization:     `Bearer ${token}`,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
  }
}

function getCredentials() {
  const token  = process.env.ACCURATE_API_TOKEN
  const secret = process.env.ACCURATE_SIGNATURE_SECRET
  const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')
  if (!token || !secret) throw new Error('ACCURATE credentials not configured')
  return { token, secret, host }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let itemNo = searchParams.get('itemNo')?.trim() ?? null
  const productId = searchParams.get('productId')?.trim() ?? null
  const debug = searchParams.get('debug') === '1'

  // Resolve productId → accurateId via DB if itemNo not provided
  if (!itemNo && productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { accurateId: true },
    })
    itemNo = product?.accurateId ?? null
  }

  if (!itemNo) {
    return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
  }

  try {
    const { token, secret, host } = getCredentials()

    // ── STEP 1: Get item ID via list.do ──────────────────────────────
    const listUrl = new URL(`${host}/accurate/api/item/list.do`)
    listUrl.searchParams.set('fields',           'id,no,name')
    listUrl.searchParams.set('sp.pageSize',      '5')
    listUrl.searchParams.set('filter.no.op',     'EQUAL')
    listUrl.searchParams.set('filter.no.val[0]', itemNo)

    const listRes  = await fetch(listUrl.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
    const listData = await listRes.json()

    if (!listData.s || !Array.isArray(listData.d) || listData.d.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    const itemId = listData.d[0].id

    // ── STEP 2: Get full item detail (includes warehouseDetail) ──────
    const detailUrl = new URL(`${host}/accurate/api/item/detail.do`)
    detailUrl.searchParams.set('id', String(itemId))

    const detailRes  = await fetch(detailUrl.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
    const detailData = await detailRes.json()

    // Return raw for debugging
    if (debug) {
      return NextResponse.json({ itemId, itemNo, raw: detailData })
    }

    if (!detailData.s || !detailData.d) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    const item = detailData.d

    // Accurate item/detail.do returns warehouseDetail (array of per-warehouse stock)
    // Field names may vary: warehouseDetail, warehouseDetails, detailWarehouse, etc.
    // Try all known field names
    const rawDetails: any[] =
      item.warehouseDetail ??
      item.warehouseDetails ??
      item.detailWarehouse ??
      item.itemWarehouseDetail ??
      item.stockWarehouse ??
      []

    if (!rawDetails || rawDetails.length === 0) {
      // Last resort fallback — return default warehouse
      return NextResponse.json({
        warehouses: [{ name: DEFAULT_WAREHOUSE, qty: item.availableToSell ?? 0 }],
        _debug: { availableFields: Object.keys(item).filter(k => k.toLowerCase().includes('warehouse') || k.toLowerCase().includes('stock') || k.toLowerCase().includes('detail')) }
      })
    }

    // Map to { name, qty }
    const warehouses = rawDetails
      .map((d: any) => ({
        name: (d.warehouseName ?? d.name ?? d.gudang ?? d.warehouse ?? '') as string,
        qty: (typeof d.availableToSell === 'number'
          ? d.availableToSell
          : typeof d.onHand === 'number'
            ? d.onHand
            : typeof d.quantity === 'number'
              ? d.quantity
              : 0) as number,
      }))
      .filter(w => Boolean(w.name))
      .sort((a, b) => b.qty - a.qty)

    if (warehouses.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    return NextResponse.json({ warehouses })
  } catch (err: any) {
    console.error('[AccurateWarehouses] Error:', err)
    return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }], _error: err.message })
  }
}
