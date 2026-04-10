import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function GET(req: Request) {
  try {
    const token = process.env.ACCURATE_API_TOKEN
    const secret = process.env.ACCURATE_SIGNATURE_SECRET
    const host = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    if (!token || !secret) {
      return NextResponse.json({ error: 'Accurate credentials not set' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const fields = searchParams.get('fields') || 'id,number,transDate,status,customer,description,grandTotal'

    const timestamp = new Date().toISOString()
    const signature = createHmac('sha256', secret).update(timestamp).digest('hex')

    const url = `${host}/accurate/api/sales-order/list.do?fields=${encodeURIComponent(fields)}&sp.pageSize=1`
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Timestamp': timestamp,
        'X-Api-Signature': signature,
      },
      cache: 'no-store',
    })
    const data = await res.json()

    return NextResponse.json({
      url,
      response: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
