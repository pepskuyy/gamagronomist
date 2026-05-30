/**
 * GET /api/accurate-warehouses?productId=xxx  (resolves via DB to Accurate itemNo)
 * GET /api/accurate-warehouses?itemNo=FG-001  (direct Accurate itemNo)
 *
 * Fetch daftar gudang Accurate yang memiliki stok untuk item tertentu.
 * Dipanggil oleh form pengajuan stok (AFA/BD) saat user memilih produk
 * agar user bisa memilih sumber gudang per SKU.
 *
 * Response:
 *   { warehouses: [{ name: string; qty: number }] }
 *
 * Fallback jika Accurate tidak tersedia atau item tidak ditemukan:
 *   { warehouses: [{ name: 'Gudang Baik', qty: 0 }] }
 */

import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_WAREHOUSE = 'Gudang Baik'

function buildHeaders(): Record<string, string> {
  const token  = process.env.ACCURATE_API_TOKEN
  const secret = process.env.ACCURATE_SIGNATURE_SECRET
  if (!token || !secret) throw new Error('ACCURATE credentials not configured')

  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex')

  return {
    Authorization:     `Bearer ${token}`,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
  }
}

function getHost(): string {
  return (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let itemNo = searchParams.get('itemNo')?.trim() ?? null
  const productId = searchParams.get('productId')?.trim() ?? null

  // Resolve productId → accurateId via DB if itemNo not provided
  if (!itemNo && productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { accurateId: true },
    })
    itemNo = product?.accurateId ?? null
  }

  if (!itemNo) {
    // No Accurate SKU found — return default
    return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
  }

  try {
    const host    = getHost()
    const headers = buildHeaders()

    // Accurate: item/list.do dengan field warehouseDetails untuk stok per gudang
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields',           'no,name,warehouseDetails')
    url.searchParams.set('sp.pageSize',      '5')
    url.searchParams.set('filter.no.op',     'EQUAL')
    url.searchParams.set('filter.no.val[0]', itemNo)

    const res  = await fetch(url.toString(), { headers, cache: 'no-store' })
    const data = await res.json()

    if (!data.s || !Array.isArray(data.d) || data.d.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    const item    = data.d[0]
    const details = item.warehouseDetails as any[] | undefined

    if (!details || details.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    // Map each warehouse to { name, qty } — prefer availableToSell over onHand
    const warehouses = details
      .map((d: any) => ({
        name: (d.warehouseName ?? d.name ?? '') as string,
        qty:  (typeof d.availableToSell === 'number'
          ? d.availableToSell
          : typeof d.onHand === 'number'
            ? d.onHand
            : 0) as number,
      }))
      .filter(w => Boolean(w.name))
      .sort((a, b) => b.qty - a.qty) // most stock first

    if (warehouses.length === 0) {
      return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
    }

    return NextResponse.json({ warehouses })
  } catch (err: any) {
    console.error('[AccurateWarehouses] Error:', err)
    // Graceful fallback — don't block the user
    return NextResponse.json({ warehouses: [{ name: DEFAULT_WAREHOUSE, qty: 0 }] })
  }
}
