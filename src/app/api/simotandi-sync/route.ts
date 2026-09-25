import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import {
  scrapePeriods,
  fetchProvinceData,
  SUPPORTED_PROVINCES,
  simotandiSleep,
} from '@/lib/simotandi'

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

    const periods = await scrapePeriods()
    if (periods.length === 0) {
      return NextResponse.json({ error: 'Daftar periode SIMOTANDI kosong' }, { status: 502 })
    }

    let target
    let remaining = 0

    if (periodeParam) {
      const id = parseInt(periodeParam, 10)
      target = periods.find((p) => p.id === id)
      if (!target) {
        return NextResponse.json({ error: `Periode ${id} tidak ditemukan` }, { status: 404 })
      }
    } else if (mode === 'backfill') {
      const year2026 = periods
        .filter((p) => p.kode.startsWith('2026'))
        .sort((a, b) => a.kode.localeCompare(b.kode))

      const synced = await prisma.simotandiPeriode.findMany({
        where: { kode: { in: year2026.map((p) => p.kode) } },
        select: { kode: true },
      })
      const syncedKodes = new Set(synced.map((s) => s.kode))

      const missing = year2026.filter((p) => !syncedKodes.has(p.kode))
      target = missing[0]
      remaining = Math.max(0, missing.length - (target ? 1 : 0))

      if (!target) {
        return NextResponse.json({
          success: true,
          mode: 'backfill',
          message: 'Semua periode 2026 sudah tersinkron',
          remaining: 0,
        })
      }
    } else {
      // Periode terbaru (opsi pertama pada <select> = paling baru)
      target = periods.reduce((a, b) => (a.id > b.id ? a : b))
    }

    // Upsert header periode
    await prisma.simotandiPeriode.upsert({
      where: { id: target.id },
      update: {
        kode: target.kode,
        label: target.label,
        startDate: target.startDate,
        endDate: target.endDate,
        syncedAt: new Date(),
      },
      create: {
        id: target.id,
        kode: target.kode,
        label: target.label,
        startDate: target.startDate,
        endDate: target.endDate,
      },
    })

    // Tarik & simpan data per provinsi
    let totalRows = 0
    for (const kdpr of SUPPORTED_PROVINCES) {
      const rows = await fetchProvinceData(target.id, kdpr)

      if (rows.length > 0) {
        await prisma.simotandiWilayah.deleteMany({ where: { periodeId: target.id, kdpr } })
        await prisma.simotandiWilayah.createMany({
          data: rows.map((r) => ({ ...r, periodeId: target.id })),
        })
        totalRows += rows.length
      }

      await simotandiSleep(1000)
    }

    revalidatePath('/dashboard')

    console.log(`[simotandi-sync] periode ${target.kode}: ${totalRows} baris tersimpan`)

    return NextResponse.json({
      success: true,
      periode: { id: target.id, kode: target.kode, label: target.label },
      rowsSaved: totalRows,
      remaining,
    })
  } catch (err: any) {
    console.error('[simotandi-sync] error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
