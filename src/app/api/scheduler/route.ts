import { NextResponse } from 'next/server'
import { getSchedulerStatus } from '@/lib/scheduler'
import { runAccurateSync } from '@/lib/accurate-sync'
import { runSimotandiSync } from '@/lib/simotandi-sync'

export const dynamic = 'force-dynamic'

/**
 * GET /api/scheduler
 * Memeriksa status in-process scheduler dan timestamp job terakhir.
 * Memerlukan header Authorization: Bearer <CRON_SECRET> jika CRON_SECRET di-set.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = getSchedulerStatus()
  return NextResponse.json({
    success: true,
    serverTimeUtc: new Date().toISOString(),
    ...status,
  })
}

/**
 * POST /api/scheduler
 * Memaksa eksekusi job tertentu secara langsung (accurate | simotandi).
 * Body: { "job": "accurate" | "simotandi" }
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const job = body?.job

    if (job === 'accurate') {
      const result = await runAccurateSync()
      return NextResponse.json({ success: true, job: 'accurate', result })
    }

    if (job === 'simotandi') {
      const result = await runSimotandiSync()
      return NextResponse.json({ success: true, job: 'simotandi', result })
    }

    return NextResponse.json(
      { error: 'Invalid job. Pilih "accurate" atau "simotandi".' },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
