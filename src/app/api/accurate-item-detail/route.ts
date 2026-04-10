import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

/**
 * GET /api/accurate-item-detail?no=PK-001
 * Temporary endpoint to inspect item detail fields (including price)
 */
export async function GET(req: Request) {
  try {
    const token = process.env.ACCURATE_API_TOKEN
    const secret = process.env.ACCURATE_SIGNATURE_SECRET
    const host = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    if (!token || !secret) {
      return NextResponse.json({ error: 'Accurate credentials not set' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const itemNo = searchParams.get('no') || 'PK-001'

    const timestamp = new Date().toISOString()
    const signature = createHmac('sha256', secret).update(timestamp).digest('hex')

    // First, list item to find ID
    const listUrl = `${host}/accurate/api/item/list.do?filter.no.val=${encodeURIComponent(itemNo)}&filter.no.op=EQUAL&sp.pageSize=1`
    
    const listRes = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Timestamp': timestamp,
        'X-Api-Signature': signature,
      },
      cache: 'no-store',
    })
    const listData = await listRes.json()

    if (!listData.s || !listData.d?.length) {
      return NextResponse.json({ error: 'Item not found', raw: listData })
    }

    const itemId = listData.d[0].id

    // Refresh timestamp for second call
    const ts2 = new Date().toISOString()
    const sig2 = createHmac('sha256', secret).update(ts2).digest('hex')

    // Get full detail
    const detailUrl = `${host}/accurate/api/item/detail.do?id=${itemId}`
    const detailRes = await fetch(detailUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Timestamp': ts2,
        'X-Api-Signature': sig2,
      },
      cache: 'no-store',
    })
    const detailData = await detailRes.json()

    return NextResponse.json({
      listEntry: listData.d[0],
      detail: detailData,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
