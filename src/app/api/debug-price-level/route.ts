import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug-price-level?itemNo=IK-150
 * Test: ambil harga item dari Accurate per kategori harga
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const itemNo = url.searchParams.get('itemNo') ?? 'IK-150'

    const token  = process.env.ACCURATE_API_TOKEN!
    const secret = process.env.ACCURATE_SIGNATURE_SECRET!
    const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    const timestamp = new Date().toISOString()
    const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
    const headers = {
      'Authorization':   `Bearer ${token}`,
      'X-Api-Timestamp': timestamp,
      'X-Api-Signature': signature,
    }

    // 1. Fetch item detail dengan fields harga
    const itemUrl = new URL(`${host}/accurate/api/item/list.do`)
    itemUrl.searchParams.set('fields', 'no,name,unitPrice,sellPrice1,sellPrice2,sellPrice3,priceLevelName')
    itemUrl.searchParams.set('sp.pageSize', '5')
    itemUrl.searchParams.set('filter.no.op', 'EQUAL')
    itemUrl.searchParams.set('filter.no.val[0]', itemNo)

    const itemRes = await fetch(itemUrl.toString(), { headers, cache: 'no-store' })
    const itemData = await itemRes.json()

    // 2. Fetch daftar price level yang tersedia
    const plUrl = new URL(`${host}/accurate/api/price-level/list.do`)
    plUrl.searchParams.set('fields', 'id,name')
    plUrl.searchParams.set('sp.pageSize', '50')

    const plTimestamp = new Date().toISOString()
    const plSignature = createHmac('sha256', secret).update(plTimestamp).digest('hex')
    const plHeaders = {
      'Authorization':   `Bearer ${token}`,
      'X-Api-Timestamp': plTimestamp,
      'X-Api-Signature': plSignature,
    }

    const plRes = await fetch(plUrl.toString(), { headers: plHeaders, cache: 'no-store' })
    const plData = await plRes.json()

    return NextResponse.json({
      queriedItem: itemNo,
      itemResult: itemData,
      priceLevels: plData,
      note: 'Cek field priceLevels.d[] untuk nama kategori harga yang valid di Accurate',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
