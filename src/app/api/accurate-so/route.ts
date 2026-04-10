import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

function buildAccurateHeaders(token: string, secret: string) {
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
  return {
    'Authorization': `Bearer ${token}`,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
  }
}

export async function GET(req: Request) {
  // Auth check
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SPV', 'ADMIN', 'BD'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.ACCURATE_API_TOKEN
  const secret = process.env.ACCURATE_SIGNATURE_SECRET
  const host = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

  if (!token || !secret) {
    return NextResponse.json({ error: 'Accurate credentials not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('from') // YYYY-MM-DD
  const dateTo = searchParams.get('to')     // YYYY-MM-DD

  try {
    let allSOs: any[] = []
    let page = 1
    const pageSize = 100

    while (true) {
      const params = new URLSearchParams()
      params.set('fields', 'id,number,transDate,status,customer,description,totalAmount,masterSalesman')
      params.set('sp.pageSize', String(pageSize))
      params.set('sp.page', String(page))
      params.set('sp.sort', 'transDate.desc')

      // Date range filters
      if (dateFrom) {
        const [y, m, d] = dateFrom.split('-')
        params.set('filter.transDate.val', `${d}/${m}/${y}`)
        params.set('filter.transDate.op', 'GREATER_THAN_OR_EQUAL')
      }
      if (dateTo) {
        const [y, m, d] = dateTo.split('-')
        params.set('filter.transDate.val2', `${d}/${m}/${y}`)
        params.set('filter.transDate.op', dateFrom ? 'BETWEEN' : 'LESS_THAN_OR_EQUAL')
      }

      const headers = buildAccurateHeaders(token, secret)
      const url = `${host}/accurate/api/sales-order/list.do?${params.toString()}`

      const res = await fetch(url, { headers, cache: 'no-store' })
      const data = await res.json()

      if (!data.s) {
        console.error('[SO API] Accurate error:', JSON.stringify(data.d))
        return NextResponse.json({ error: 'Gagal mengambil data SO dari Accurate.', detail: data.d }, { status: 502 })
      }

      const items: any[] = data.d ?? []
      allSOs = allSOs.concat(items)

      // Check if there are more pages
      const totalPages = data.sp?.pageCount ?? 1
      if (page >= totalPages || items.length < pageSize) break
      page++
    }

    // Filter by salesman containing "Business Development" (case-insensitive)
    const filtered = allSOs.filter(so => {
      const salesmanStr = String(so.masterSalesman?.name ?? '')
      return salesmanStr.toLowerCase().includes('business development') || 
             salesmanStr.toLowerCase().includes('busdev') ||
             salesmanStr.toLowerCase() === 'busdev'
    })

    return NextResponse.json({ success: true, data: filtered, total: filtered.length })
  } catch (err: any) {
    console.error('[SO API] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
