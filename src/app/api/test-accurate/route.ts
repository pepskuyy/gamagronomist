import { NextResponse } from 'next/server'
import { fetchAccurateCustomers } from '@/lib/accurate'

export async function GET() {
  try {
    const { token, secret, host } = require('@/lib/accurate').getCredentials()
    
    const url = new URL(`${host}/accurate/api/customer/list.do`)
    url.searchParams.set('fields', 'id,name,defaultSalespersonName,salespersonName,salesmanName,defaultSalesmanName,salesman')
    url.searchParams.set('sp.pageSize', '2')
    
    const crypto = require('crypto')
    const timestamp = new Date().toISOString()
    const signature = crypto.createHmac('sha256', secret).update(timestamp).digest('hex')
    
    const res = await fetch(url.toString(), { 
      headers: { 
        Authorization: `Bearer ${token}`,
        'X-Api-Timestamp': timestamp,
        'X-Api-Signature': signature
      } 
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
