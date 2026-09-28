import prisma from '@/lib/prisma'
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
}

export type SimotandiSyncResult = {
  success: boolean
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
  const { mode, periode: periodeParam } = options

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

  console.log(`[simotandi-sync] periode ${target.kode}: ${totalRows} baris tersimpan`)

  return {
    success: true,
    periode: { id: target.id, kode: target.kode, label: target.label },
    rowsSaved: totalRows,
    remaining,
  }
}
