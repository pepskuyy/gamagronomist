/**
 * Konfigurasi fase pertanaman padi SIMOTANDI + helper agregasi.
 * Dipakai bersama oleh layer peta, legenda, kartu ringkasan, dan panel detail.
 */

export type SimotandiWilayahRow = {
  level: string
  nama: string
  kdpr: string
  kdkb: string | null
  kdkc: string | null
  bera: number
  penyiapanLahan: number
  tanam: number
  veg1: number
  veg2: number
  gen1: number
  gen2: number
  panen: number
  standingCrop: number
  lsb: number
}

export type FaseKey =
  | 'bera' | 'penyiapanLahan' | 'tanam'
  | 'veg1' | 'veg2' | 'gen1' | 'gen2' | 'panen'

export const FASE_ORDER: FaseKey[] = [
  'bera', 'penyiapanLahan', 'tanam', 'veg1', 'veg2', 'gen1', 'gen2', 'panen',
]

export const FASE_CONFIG: Record<FaseKey, { label: string; short: string; color: string }> = {
  bera:           { label: 'Bera & Non Padi',          short: 'Bera',       color: '#9ca3af' },
  penyiapanLahan: { label: 'Penyiapan Lahan',          short: 'Penyiapan',  color: '#93c5fd' },
  tanam:          { label: 'Tanam (1–12 HST)',         short: 'Tanam',      color: '#60a5fa' },
  veg1:           { label: 'Vegetatif 1 (13–36 HST)',  short: 'Veg 1',      color: '#86efac' },
  veg2:           { label: 'Vegetatif 2 (37–60 HST)',  short: 'Veg 2',      color: '#22c55e' },
  gen1:           { label: 'Generatif 1 (61–84 HST)',  short: 'Gen 1',      color: '#fbbf24' },
  gen2:           { label: 'Generatif 2 (85–120 HST)', short: 'Gen 2',      color: '#fde68a' },
  panen:          { label: 'Panen',                    short: 'Panen',      color: '#fb923c' },
}

/** Fase dengan luas terbesar pada satu wilayah */
export function dominantFase(row: SimotandiWilayahRow): FaseKey {
  let best: FaseKey = 'bera'
  let bestVal = -1
  for (const key of FASE_ORDER) {
    const val = row[key]
    if (val > bestVal) {
      bestVal = val
      best = key
    }
  }
  return best
}

/** Jumlahkan beberapa baris wilayah menjadi satu objek fase */
export function sumRows(rows: SimotandiWilayahRow[]): Record<FaseKey, number> & { standingCrop: number; lsb: number } {
  const acc: any = { standingCrop: 0, lsb: 0 }
  for (const key of FASE_ORDER) acc[key] = 0

  for (const r of rows) {
    for (const key of FASE_ORDER) acc[key] += r[key] ?? 0
    acc.standingCrop += r.standingCrop ?? 0
    acc.lsb += r.lsb ?? 0
  }
  return acc
}

/** Format luas (Ha) ala SIMOTANDI: "1.103" atau "140,6rb" */
export function formatHa(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace('.', ',')}rb`
  return Math.round(n).toLocaleString('id-ID')
}

/** Kelompok ringkas untuk kartu ringkasan */
export const SUMMARY_GROUPS: { label: string; icon: string; keys: FaseKey[]; color: string }[] = [
  { label: 'Tanam',       icon: '🌱', keys: ['tanam'],                     color: '#3b82f6' },
  { label: 'Vegetatif',   icon: '🌿', keys: ['veg1', 'veg2'],              color: '#16a34a' },
  { label: 'Generatif',   icon: '🌾', keys: ['gen1', 'gen2'],              color: '#d97706' },
  { label: 'Panen',       icon: '🚜', keys: ['panen'],                     color: '#ea580c' },
  { label: 'Penyiapan',   icon: '💧', keys: ['penyiapanLahan'],            color: '#0ea5e9' },
  { label: 'Bera',        icon: '🏜️', keys: ['bera'],                      color: '#6b7280' },
]
