/**
 * GET /api/debug-accurate-warehouses?itemNo=STR-001
 * 
 * Debug endpoint: shows all keys returned by Accurate item/detail.do
 * and the raw warehouseDetail-like fields to understand the correct structure.
 * 
 * TEMPORARY — remove after debugging is done.
 */

import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function buildHeaders(secret: string, token: string) {
  const ts  = new Date().toISOString()
  const sig = createHmac('sha256', secret).update(ts).digest('hex')
  return { Authorization: `Bearer ${token}`, 'X-Api-Timestamp': ts, 'X-Api-Signature': sig }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const itemNo    = searchParams.get('itemNo') ?? null
  const productId = searchParams.get('productId') ?? null
  const token  = process.env.ACCURATE_API_TOKEN!
  const secret = process.env.ACCURATE_SIGNATURE_SECRET!
  const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

  let resolvedItemNo = itemNo
  if (!resolvedItemNo && productId) {
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { accurateId: true, name: true } })
    resolvedItemNo = p?.accurateId ?? null
  }

  if (!resolvedItemNo) return NextResponse.json({ error: 'Provide itemNo or productId' }, { status: 400 })

  // Step 1: Get item ID
  const listUrl = `${host}/accurate/api/item/list.do?fields=id,no,name&filter.no.op=EQUAL&filter.no.val[0]=${encodeURIComponent(resolvedItemNo)}&sp.pageSize=5`
  const listData = await fetch(listUrl, { headers: buildHeaders(secret, token), cache: 'no-store' }).then(r => r.json())

  if (!listData.s || !listData.d?.length) {
    return NextResponse.json({ error: 'Item not found', listData })
  }

  const itemId   = listData.d[0].id
  const listEntry = listData.d[0]

  // Step 2: Get detail
  const detailUrl = `${host}/accurate/api/item/detail.do?id=${itemId}`
  const detailData = await fetch(detailUrl, { headers: buildHeaders(secret, token), cache: 'no-store' }).then(r => r.json())

  const detail = detailData.d ?? {}

  // Extract only relevant keys (warehouse, stock, detail related)
  const allKeys = Object.keys(detail)
  const warehouseRelatedKeys = allKeys.filter(k => 
    k.toLowerCase().includes('warehouse') || 
    k.toLowerCase().includes('stock') ||
    k.toLowerCase().includes('detail') ||
    k.toLowerCase().includes('gudang') ||
    k.toLowerCase().includes('available')
  )

  const warehouseData: Record<string, any> = {}
  for (const k of warehouseRelatedKeys) {
    warehouseData[k] = detail[k]
  }

  // Also try item/list.do with ALL fields to see what warehouseDetails looks like
  const listAllUrl = `${host}/accurate/api/item/list.do?fields=no,availableToSell,warehouseDetails,warehouseDetail,detailWarehouse&filter.no.op=EQUAL&filter.no.val[0]=${encodeURIComponent(resolvedItemNo)}&sp.pageSize=1`
  const listAllData = await fetch(listAllUrl, { headers: buildHeaders(secret, token), cache: 'no-store' }).then(r => r.json())

  return NextResponse.json({
    itemNo: resolvedItemNo,
    itemId,
    listEntry,
    allDetailKeys: allKeys,
    warehouseRelatedFields: warehouseData,
    listWithWarehouseFields: listAllData.d?.[0] ?? null,
  })
}
