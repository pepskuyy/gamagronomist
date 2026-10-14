import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { runFullSalesSync, syncSalesCustomers, syncSalesInvoices } from '@/lib/sales-dashboard'
import { runAccurateSync } from '@/lib/accurate-sync'
import { runSimotandiSync } from '@/lib/simotandi-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 mins

async function verifyAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  const session = await decrypt(token)
  if (!session?.userId || session.role !== 'ADMIN') return null
  return session
}

export async function GET(req: Request) {
  const session = await verifyAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Akses ditolak. Khusus ADMIN.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '30', 10)))
  const skip = (page - 1) * limit
  const typeFilter = url.searchParams.get('type') || undefined
  const statusFilter = url.searchParams.get('status') || undefined

  try {
    const where: any = {}
    if (typeFilter) {
      where.dataType = { contains: typeFilter, mode: 'insensitive' }
    }
    if (statusFilter) {
      where.status = statusFilter
    }

    const [total, logs, stats] = await Promise.all([
      prisma.syncLog.count({ where }),
      prisma.syncLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.syncLog.groupBy({
        by: ['status'],
        _count: { _all: true },
      }).catch(() => []),
    ])

    const successCount = stats.find((s) => s.status === 'SUCCESS')?._count._all || 0
    const failedCount = stats.find((s) => s.status === 'FAILED')?._count._all || 0
    const runningCount = stats.find((s) => s.status === 'RUNNING')?._count._all || 0

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
      summary: {
        totalRuns: total,
        successCount,
        failedCount,
        runningCount,
        lastRun: logs[0] ? logs[0].startedAt : null,
      },
    })
  } catch (err: any) {
    console.error('[API sync-monitor GET] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Gagal mengambil data monitoring sinkronisasi' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await verifyAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Akses ditolak. Khusus ADMIN.' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const type = body?.type || 'all-sales'

    if (type === 'sales-customers') {
      const result = await syncSalesCustomers('MANUAL')
      return NextResponse.json({ success: true, type, result })
    }

    if (type === 'sales-invoices') {
      const result = await syncSalesInvoices(undefined, undefined, 'MANUAL')
      return NextResponse.json({ success: true, type, result })
    }

    if (type === 'all-sales' || type === 'sales-dashboard') {
      const result = await runFullSalesSync(undefined, undefined, 'MANUAL')
      return NextResponse.json({ success: true, type, result })
    }

    if (type === 'accurate') {
      const result = await runAccurateSync('MANUAL')
      return NextResponse.json({ success: true, type, result })
    }

    if (type === 'simotandi') {
      const result = await runSimotandiSync({ triggerType: 'MANUAL' })
      return NextResponse.json({ success: true, type, result })
    }

    return NextResponse.json(
      { error: 'Tipe sinkronisasi tidak valid. Pilih: sales-dashboard, sales-customers, sales-invoices, accurate, atau simotandi.' },
      { status: 400 }
    )
  } catch (err: any) {
    console.error('[API sync-monitor POST] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Gagal menjalankan sinkronisasi manual.' },
      { status: 500 }
    )
  }
}
