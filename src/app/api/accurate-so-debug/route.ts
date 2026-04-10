import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

function buildHeaders(token: string, secret: string) {
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
  return {
    'Authorization': `Bearer ${token}`,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
  }
}

async function tryEndpoint(host: string, token: string, secret: string, queryExt: string) {
  const url = `${host}/accurate/api/sales-order/list.do?sp.pageSize=1&fields=id,number,transDate,status,customer,description,totalAmount,masterSalesman${queryExt}`
  try {
    const res = await fetch(url, { headers: buildHeaders(token, secret), cache: 'no-store' })
    const data = await res.json()
    return { queryExt, ok: data.s === true, status: res.status, response: data }
  } catch (err: any) {
    return { queryExt, ok: false, error: err.message }
  }
}

export async function GET() {
  try {
    const token = process.env.ACCURATE_API_TOKEN
    const secret = process.env.ACCURATE_SIGNATURE_SECRET
    const host = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    if (!token || !secret) {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 })
    }

    const testQueries = [
      '',
      '&filter.transDate.op=EQUAL&filter.transDate.val=10/04/2026',
      '&filter.transDate.op=GREATER_THAN_OR_EQUAL&filter.transDate.val=01/03/2026',
      '&filter.transDate.op=BETWEEN&filter.transDate.val=01/03/2026&filter.transDate.val2=10/04/2026',
      '&filter.transDate.val=01/03/2026&filter.transDate.val2=10/04/2026',
    ]

    const results = []
    for (const q of testQueries) {
        results.push(await tryEndpoint(host, token, secret, q))
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
