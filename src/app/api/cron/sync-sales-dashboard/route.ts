import { NextResponse } from 'next/server'
import { runFullSalesSync, syncSalesCustomers, syncSalesInvoices } from '@/lib/sales-dashboard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 mins for multi-chunk invoice sync

export async function GET(req: Request) {
  const url = new URL(req.url)
  const authHeader = req.headers.get('authorization')
  const secretParam = url.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const isBearerValid = authHeader === `Bearer ${cronSecret}`
    const isParamValid = secretParam === cronSecret
    if (!isBearerValid && !isParamValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const only = url.searchParams.get('only')

  try {
    if (only === 'customers') {
      const res = await syncSalesCustomers()
      return NextResponse.json({ success: true, type: 'customers', ...res })
    }

    if (only === 'invoices') {
      const res = await syncSalesInvoices(from, to)
      return NextResponse.json({ success: true, type: 'invoices', from, to, ...res })
    }

    const res = await runFullSalesSync(from, to)
    return NextResponse.json({
      success: true,
      from: from || '90-days-ago',
      to: to || 'today',
      ...res,
    })
  } catch (err: any) {
    console.error('[cron/sync-sales-dashboard] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan saat sinkronisasi data Sales Dashboard' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
