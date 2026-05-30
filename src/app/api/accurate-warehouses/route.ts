/**
 * GET /api/accurate-warehouses?productId=xxx  (resolves via DB to Accurate itemNo)
 * GET /api/accurate-warehouses?itemNo=IK-052  (direct Accurate itemNo)
 *
 * Strategy: 
 * 1. Fetch all warehouses from Accurate (warehouse/list.do) — cached 5min
 * 2. Batch-query item/list.do with warehouseId filter for each warehouse in parallel
 * 3. Return warehouses where the item has stock (availableToSell > 0) + all warehouses (qty 0) for selection
 *
 * Response: { warehouses: [{ name: string; qty: number }] }
 * Sorted: positive qty first (desc), then zero-stock warehouses alphabetically
 */

import { NextResponse } from 'next/server'
import { createHmac }   from 'crypto'
import prisma           from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_WAREHOUSE = 'Gudang Baik'

// Simple in-process cache for warehouse list (refreshes every 5 min)
let _warehouseCache: { id: number; name: string }[] | null = null
let _warehouseCacheAt = 0

function buildHeaders(secret: string, token: string): Record<string, string> {
  const ts  = new Date().toISOString()
  const sig = createHmac('sha256', secret).update(ts).digest('hex')
  return { Authorization: `Bearer ${token}`, 'X-Api-Timestamp': ts, 'X-Api-Signature': sig }
}

function getEnv() {
  const token  = process.env.ACCURATE_API_TOKEN
  const secret = process.env.ACCURATE_SIGNATURE_SECRET
  const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')
  if (!token || !secret) throw new Error('ACCURATE credentials not configured')
  return { token, secret, host }
}

/** Fetch list of all warehouses from Accurate. Cached for 5 minutes. */
async function fetchAllWarehouses(token: string, secret: string, host: string) {
  const now = Date.now()
  if (_warehouseCache && now - _warehouseCacheAt < 5 * 60 * 1000) {
    return _warehouseCache
  }

  const url = new URL(`${host}/accurate/api/warehouse/list.do`)
  url.searchParams.set('fields',      'id,name')
  url.searchParams.set('sp.pageSize', '200')

  const res  = await fetch(url.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
  const data = await res.json()

  if (!data.s || !Array.isArray(data.d)) return []

  const warehouses = data.d
    .map((w: any) => ({ id: w.id as number, name: (w.name ?? '') as string }))
    .filter((w: any) => Boolean(w.name))

  _warehouseCache   = warehouses
  _warehouseCacheAt = now
  return warehouses
}

/**
 * For a given itemNo + warehouseId, fetch availableToSell from Accurate.
 * Returns null if item not in warehouse.
 */
async function fetchItemQtyInWarehouse(
  token: string, secret: string, host: string,
  itemNo: string, warehouseId: number
): Promise<number | null> {
  try {
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields',                  'no,availableToSell')
    url.searchParams.set('sp.pageSize',             '5')
    url.searchParams.set('filter.no.op',            'EQUAL')
    url.searchParams.set('filter.no.val[0]',        itemNo)
    url.searchParams.set('filter.warehouseId.op',   'EQUAL')
    url.searchParams.set('filter.warehouseId.val',  String(warehouseId))

    const res  = await fetch(url.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
    const data = await res.json()

    if (!data.s || !Array.isArray(data.d) || data.d.length === 0) return null
    return (data.d[0].availableToSell as number) ?? 0
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let itemNo    = searchParams.get('itemNo')?.trim() ?? null
  const productId = searchParams.get('productId')?.trim() ?? null

  // Resolve productId → accurateId via DB
  if (!itemNo && productId) {
    const product = await prisma.product.findUnique({
      where:  { id: productId },
      select: { accurateId: true },
    })
    itemNo = product?.accurateId ?? null
  }

  if (!itemNo) {
    return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
  }

  try {
    const { token, secret, host } = getEnv()

    // Step 1: Get all warehouses
    const allWarehouses = await fetchAllWarehouses(token, secret, host)
    if (allWarehouses.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    // Step 2: Parallel query — check stock in each warehouse
    // Batch in groups of 10 to avoid rate limiting
    const BATCH = 10
    const results: { name: string; qty: number }[] = []

    for (let i = 0; i < allWarehouses.length; i += BATCH) {
      const batch = allWarehouses.slice(i, i + BATCH)
      const batchResults = await Promise.all(
        batch.map(async (wh) => {
          const qty = await fetchItemQtyInWarehouse(token, secret, host, itemNo!, wh.id)
          return { name: wh.name, qty: qty ?? 0, hasItem: qty !== null }
        })
      )
      results.push(...batchResults.filter(r => r.hasItem || r.qty > 0))
    }

    if (results.length === 0) {
      // Fallback: item not found in any warehouse — return all warehouses with qty 0
      const fallback = allWarehouses.map(w => ({ name: w.name, qty: 0 }))
      return NextResponse.json({ warehouses: fallback })
    }

    // Sort: positive stock first (desc), then zero-stock
    results.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))

    return NextResponse.json({ warehouses: results })

  } catch (err: any) {
    console.error('[AccurateWarehouses] Error:', err)
    return NextResponse.json({
      warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }],
      _error: err.message
    })
  }
}
