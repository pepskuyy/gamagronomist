import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { runFullSalesSync, syncSalesCustomers, syncSalesInvoices } from '@/lib/sales-dashboard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 mins for multi-chunk invoice sync

export async function GET(req: Request) {
  const url = new URL(req.url)
  const authHeader = req.headers.get('authorization')
  const secretParam = url.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  // 1. Cek apakah pemanggil memiliki session login valid (dipicu dari tombol web dashboard)
  let isAuthenticatedUser = false
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (sessionToken) {
      const session = await decrypt(sessionToken)
      if (session?.userId) {
        isAuthenticatedUser = true
      }
    }
  } catch {
    isAuthenticatedUser = false
  }

  // 2. Cek apakah request dari Cron / API eksternal dengan CRON_SECRET yang valid
  const isCronAuthorized = cronSecret
    ? authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret
    : false

  // Jika CRON_SECRET diset, pemanggil harus salah satu: user terautentikasi ATAU cron secret valid
  if (cronSecret && !isAuthenticatedUser && !isCronAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
