import prisma from '@/lib/prisma'
import { startSyncLog, completeSyncLog, failSyncLog } from '@/lib/sync-logger'
import { invalidateCacheTag, CACHE_TAGS } from '@/lib/data-cache'
import {
  scrapePeriods,
  fetchProvinceData,
  SUPPORTED_PROVINCES,
  simotandiSleep,
  SimotandiPeriodeInfo,
} from '@/lib/simotandi'

export type SimotandiSyncOptions = {
  mode?: string | null
  periode?: number | null
  triggerType?: 'MANUAL' | 'OTOMATIS'
}

export type SimotandiSyncResult = {
  success: boolean
  mode?: string
  periode?: { id: number; kode: string; label: string }
  rowsSaved: number
  remaining: number
  message?: string
}

/**
 * Core logic sinkronisasi data fase tanam padi dari SIMOTANDI ke database lokal.
 * Dapat dipanggil oleh Route Handler (/api/simotandi-sync) maupun internal scheduler.
 */
export async function runSimotandiSync(
  options: SimotandiSyncOptions = {}
): Promise<SimotandiSyncResult> {
  const startTime = Date.now()
  const { mode, periode: periodeParam, triggerType = 'MANUAL' } = options

  const logId = await startSyncLog({
    dataType: 'Fase Padi (SIMOTANDI Kementan)',
    triggerType,
    message: 'Mengambil data fase tanam padi dari SIMOTANDI Kementan...',
  })

  try {
    const periods = await scrapePeriods()
    if (periods.length === 0) {
      throw new Error('Daftar periode SIMOTANDI kosong')
    }

    let target: SimotandiPeriodeInfo | undefined
    let remaining = 0

    if (periodeParam) {
      target = periods.find((p) => p.id === periodeParam)
      if (!target) {
        throw new Error(`Periode ${periodeParam} tidak ditemukan`)
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
        const duration = Date.now() - startTime
        await completeSyncLog(logId, {
          processedCount: 0,
          message: 'Semua periode 2026 SIMOTANDI sudah tersinkron',
          durationMs: duration,
        })
        return {
          success: true,
          mode: 'backfill',
          message: 'Semua periode 2026 sudah tersinkron',
          remaining: 0,
          rowsSaved: 0,
        }
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

    // Invalidasi cache data SIMOTANDI (/api/simotandi/*). Bila dipanggil dari
    // scheduler in-process (tanpa request context), invalidasi dilewati dan
    // cache kedaluwarsa via TTL (maks. 1 jam).
    invalidateCacheTag(CACHE_TAGS.simotandi)

    const duration = Date.now() - startTime
    console.log(`[simotandi-sync] periode ${target.kode}: ${totalRows} baris tersimpan`)

    await completeSyncLog(logId, {
      processedCount: totalRows,
      message: `Sinkronisasi SIMOTANDI periode ${target.kode} selesai: ${totalRows} wilayah tersimpan`,
      durationMs: duration,
    })

    return {
      success: true,
      periode: { id: target.id, kode: target.kode, label: target.label },
      rowsSaved: totalRows,
      remaining,
    }
  } catch (err: any) {
    const duration = Date.now() - startTime
    await failSyncLog(logId, {
      error: err,
      message: `Gagal sinkronisasi SIMOTANDI: ${err?.message || 'Error'}`,
      durationMs: duration,
    })
    throw err
  }
}
