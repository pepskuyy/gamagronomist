import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { runSimotandiSync } from '@/lib/simotandi-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/simotandi-sync
 *
 * Sinkronisasi data fase tanam padi dari SIMOTANDI ke database lokal.
 *
 * Mode:
 *   (default)            -> sinkronkan periode terbaru saja (dipakai cron harian)
 *   ?mode=backfill       -> sinkronkan SATU periode 2026 terlama yang belum ada,
 *                           lalu laporkan sisa. Ulangi sampai remaining = 0.
 *   ?periode=<id>        -> sinkronkan periode tertentu
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (jika CRON_SECRET di-set)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (!cronSecret) {
    console.warn('[simotandi-sync] CRON_SECRET belum di-set, skip auth check.')
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[simotandi-sync] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const mode = url.searchParams.get('mode')
    const periodeParam = url.searchParams.get('periode')
    const parsedPeriode = periodeParam ? parseInt(periodeParam, 10) : null

    const result = await runSimotandiSync({
      mode,
      periode: parsedPeriode && !isNaN(parsedPeriode) ? parsedPeriode : null,
    })

    revalidatePath('/dashboard')

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[simotandi-sync] error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

