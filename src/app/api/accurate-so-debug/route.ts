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

async function tryEndpoint(host: string, token: string, secret: string, fields: string) {
  const url = `${host}/accurate/api/sales-order/list.do?sp.pageSize=1&fields=${fields}`
  try {
    const res = await fetch(url, { headers: buildHeaders(token, secret), cache: 'no-store' })
    const data = await res.json()
    return { fields, ok: data.s === true, status: res.status, response: data }
  } catch (err: any) {
    return { fields, ok: false, error: err.message }
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

    const testFields = [
      'number,transDate,status',
      'number,transDate,status,customer',
      'number,transDate,status,customer,description',
      'number,transDate,status,customer,description,grandTotal',
      'number,transDate,status,customer,description,grandTotal,salesman',
      'number,transDate,status,customer,description,totalAmount', // maybe grandTotal -> totalAmount?
      'number,transDate,status,customer,description,masterSalesman' // maybe salesman -> masterSalesman?
    ]

    const results = []
    for (const fields of testFields) {
        results.push(await tryEndpoint(host, token, secret, fields))
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
