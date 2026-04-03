import { NextResponse } from 'next/server'
import { runAccurateSync } from '@/lib/accurate-sync'

/**
 * GET /api/accurate-sync-cron
 * Dipanggil otomatis oleh Vercel Cron setiap 30 menit.
 * Dilindungi dengan CRON_SECRET — hanya Vercel yang bisa memanggil endpoint ini.
 *
 * Jadwal: lihat vercel.json di root project.
 */
export async function GET(req: Request) {
  // Verifikasi request berasal dari Vercel Cron scheduler
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[accurate-sync-cron] CRON_SECRET belum di-set, skip auth check.')
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[accurate-sync-cron] Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[accurate-sync-cron] Memulai auto-sync dari Accurate...')
    const result = await runAccurateSync()
    console.log(`[accurate-sync-cron] Selesai: ${result.updated} updated, ${result.inserted} inserted, ${result.skipped} skipped`)

    return NextResponse.json({
      success: true,
      trigger: 'cron',
      ...result,
    })
  } catch (err: any) {
    console.error('[accurate-sync-cron] error:', err)
    return NextResponse.json({
      error: err.message ?? 'Unknown error'
    }, { status: 500 })
  }
}
