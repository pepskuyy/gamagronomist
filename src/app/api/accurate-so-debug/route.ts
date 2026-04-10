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

async function tryEndpoint(host: string, token: string, secret: string, queryStr: string) {
  const url = `${host}/accurate/api/sales-order/list.do?${queryStr}`
  try {
    const res = await fetch(url, { headers: buildHeaders(token, secret), cache: 'no-store' })
    const data = await res.json()
    return { queryStr, ok: data.s === true, status: res.status, response: data }
  } catch (err: any) {
    return { queryStr, ok: false, error: err.message }
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

    const testUrlParams = (hasSort: boolean) => {
      const params = new URLSearchParams()
      params.set('fields', 'id,number,transDate,status,customer,description,totalAmount,masterSalesman')
      params.set('sp.pageSize', '1')
      params.set('sp.page', '1')

      if (hasSort) {
        params.set('sp.sort', 'transDate.desc') // Try with sort
      }

      params.set('filter.transDate.op', 'BETWEEN')
      params.set('filter.transDate.val', '01/03/2026')
      params.set('filter.transDate.val2', '10/04/2026')

      return params.toString()
    }

    const results = [
      await tryEndpoint(host, token, secret, testUrlParams(false)),
      await tryEndpoint(host, token, secret, testUrlParams(true)),
    ]

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
