/**
 * GET /api/accurate-warehouses?productId=xxx  (resolves via DB to Accurate itemNo)
 * GET /api/accurate-warehouses?itemNo=IK-052  (direct Accurate itemNo)
 *
 * Strategy (correct Accurate API usage):
 * 1. Fetch all warehouses via warehouse/list.do (cached 5min)
 * 2. For each warehouse, call item/list.do?no=IK-052&warehouseName=X
 *    → Accurate returns availableToSell SPECIFIC to that warehouse (not total)
 * 3. Return warehouses where qty > 0 (sorted desc) + show 0-stock warehouses too
 *
 * Key: warehouseName param in item/list.do filters the availableToSell to that warehouse only.
 *
 * Response: { warehouses: [{ name: string; qty: number }] }
 */

import { NextResponse } from 'next/server'
import { createHmac }   from 'crypto'
import prisma           from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_WAREHOUSE = 'Gudang Baik'

// In-process cache for warehouse list (5 min TTL)
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

/** Fetch all warehouses — cached 5 min */
async function fetchAllWarehouses(token: string, secret: string, host: string) {
  const now = Date.now()
  if (_warehouseCache && now - _warehouseCacheAt < 5 * 60 * 1000) return _warehouseCache

  const url = new URL(`${host}/accurate/api/warehouse/list.do`)
  url.searchParams.set('fields',      'id,name')
  url.searchParams.set('sp.pageSize', '200')

  const res  = await fetch(url.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
  const data = await res.json()
  if (!data.s || !Array.isArray(data.d)) return []

  const warehouses = (data.d as any[])
    .map(w => ({ id: w.id as number, name: (w.name ?? '') as string }))
    .filter(w => w.name)

  _warehouseCache   = warehouses
  _warehouseCacheAt = now
  return warehouses
}

/**
 * Fetch availableToSell for itemNo in a specific warehouse.
 * Uses warehouseName query param — Accurate returns per-warehouse qty when set.
 * Returns null if item doesn't exist in this warehouse (no rows returned).
 */
async function fetchItemQtyByWarehouseName(
  token: string, secret: string, host: string,
  itemNo: string, warehouseName: string
): Promise<number | null> {
  try {
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields',           'no,availableToSell')
    url.searchParams.set('sp.pageSize',      '5')
    url.searchParams.set('filter.no.op',     'EQUAL')
    url.searchParams.set('filter.no.val[0]', itemNo)
    url.searchParams.set('warehouseName',    warehouseName)  // ← KEY: filters availableToSell per warehouse

    const res  = await fetch(url.toString(), { headers: buildHeaders(secret, token), cache: 'no-store' })
    const data = await res.json()

    if (!data.s || !Array.isArray(data.d) || data.d.length === 0) return null
    const qty = data.d[0].availableToSell
    return typeof qty === 'number' ? qty : 0
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

    // Step 1: Get all warehouses (cached)
    const allWarehouses = await fetchAllWarehouses(token, secret, host)
    if (allWarehouses.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    // Step 2: Parallel query — per-warehouse qty using warehouseName param
    // Batch by 10 to avoid hammering Accurate
    const BATCH = 10
    const results: { name: string; qty: number }[] = []

    for (let i = 0; i < allWarehouses.length; i += BATCH) {
      const batch = allWarehouses.slice(i, i + BATCH)
      const batchResults = await Promise.all(
        batch.map(async (wh) => {
          const qty = await fetchItemQtyByWarehouseName(token, secret, host, itemNo!, wh.name)
          return qty !== null ? { name: wh.name, qty } : null
        })
      )
      for (const r of batchResults) {
        if (r !== null) results.push(r)
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    // Sort: highest stock first, then alphabetical
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
