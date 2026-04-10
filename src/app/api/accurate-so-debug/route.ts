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

async function tryEndpoint(host: string, token: string, secret: string, path: string, extraParams = '') {
  const url = `${host}/accurate/api/${path}?sp.pageSize=1${extraParams}`
  try {
    const res = await fetch(url, { headers: buildHeaders(token, secret), cache: 'no-store' })
    const data = await res.json()
    return { path, url, ok: data.s === true, status: res.status, response: data }
  } catch (err: any) {
    return { path, url, ok: false, error: err.message }
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

    // Test candidate endpoint paths
    const results = await Promise.all([
      tryEndpoint(host, token, secret, 'sales-order/list.do'),
      tryEndpoint(host, token, secret, 'sales-order/list.do', '&fields=number,transDate,status'),
      tryEndpoint(host, token, secret, 'salesOrder/list.do'),
      tryEndpoint(host, token, secret, 'sale-order/list.do'),
    ])

    // Also try to get detailed error from main endpoint without paging
    const debugUrl = `${host}/accurate/api/sales-order/list.do`
    const debugRes = await fetch(debugUrl, { headers: buildHeaders(token, secret), cache: 'no-store' })
    const debugData = await debugRes.json()

    return NextResponse.json({ results, minimalTest: { url: debugUrl, response: debugData } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
