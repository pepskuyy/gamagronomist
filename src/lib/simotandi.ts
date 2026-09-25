/**
 * Tujuan     : Client & parser data SIMOTANDI (Sistem Monitoring Pertanaman Padi)
 *              https://simotandi.pertanian.go.id — Kementerian Pertanian RI
 * Caller     : app/api/simotandi-sync/route.ts
 * Dependensi : fetch (Node 18+)
 * Main Functions: scrapePeriods, fetchProvinceData, fetchKabupatenList, parsePeriodeLabel
 * Side Effects  : HTTP GET ke situs SIMOTANDI (dengan jeda antar request)
 */

import FALLBACK_PERIODS from './simotandi-periods.json'

export const SIMOTANDI_BASE = 'https://simotandi.pertanian.go.id'

/** Provinsi yang didukung: Jawa Tengah, DI Yogyakarta, Jawa Timur */
export const SUPPORTED_PROVINCES = ['33', '34', '35'] as const

export const PROVINCE_LABEL: Record<string, string> = {
  '33': 'Jawa Tengah',
  '34': 'Daerah Istimewa Yogyakarta',
  '35': 'Jawa Timur',
}

export type SimotandiLevel = 'provinsi' | 'kabupaten' | 'kecamatan'

export type SimotandiRow = {
  level: SimotandiLevel
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

export type SimotandiPeriodeInfo = {
  id: number
  kode: string
  label: string
  startDate: Date | null
  endDate: Date | null
}

const MONTHS_ID: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Header mirip browser. Beberapa WAF pemerintah menolak User-Agent non-browser
 * atau request tanpa Accept-Language/Referer.
 */
function buildHeaders(json: boolean, referer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': json
      ? 'application/json, text/javascript, */*; q=0.01'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  }
  if (referer) headers['Referer'] = referer
  if (json) headers['X-Requested-With'] = 'XMLHttpRequest'
  else headers['Upgrade-Insecure-Requests'] = '1'
  return headers
}

async function politeText(
  url: string,
  { json = false, retries = 2 }: { json?: boolean; retries?: number } = {}
): Promise<string> {
  const referer = `${SIMOTANDI_BASE}/data-tabular`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: buildHeaders(json, referer) })
      if (!res.ok) {
        // Sertakan potongan body agar penyebab (WAF/blokir IP) terlihat di log
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').slice(0, 180)
        throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ''}`)
      }
      return await res.text()
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(1500 * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Parse satu bagian tanggal Indonesia.
 * Menerima "29 Agustus 2026" (lengkap) atau "17" (butuh fallback bulan/tahun).
 */
function parseDateId(text: string, fallback?: { month: number; year: number }): Date | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = MONTHS_ID[parts[1].toLowerCase()]
    const year = parseInt(parts[2], 10)
    if (Number.isFinite(day) && month !== undefined && Number.isFinite(year)) {
      return new Date(Date.UTC(year, month, day))
    }
    return null
  }
  if (parts.length === 1 && fallback) {
    const day = parseInt(parts[0], 10)
    if (Number.isFinite(day)) {
      return new Date(Date.UTC(fallback.year, fallback.month, day))
    }
  }
  return null
}

/**
 * Parse label periode SIMOTANDI, mis.:
 *   "202621 | 29 Agustus 2026 - 09 September 2026"  -> kode 202621, 29 Agu - 09 Sep 2026
 *   "202620 | 17 - 28 Agustus 2026"                  -> kode 202620, 17 - 28 Agu 2026
 */
export function parsePeriodeLabel(label: string): {
  kode: string
  startDate: Date | null
  endDate: Date | null
} {
  const [kodePart, rangePart] = label.split('|').map((s) => s.trim())
  const kode = kodePart ?? ''
  if (!rangePart) return { kode, startDate: null, endDate: null }
  if (!rangePart.includes('-')) return { kode, startDate: null, endDate: null }

  const [rawStart, rawEnd] = rangePart.split(' - ').map((s) => s.trim())

  // Coba parse tanggal akhir dulu (selalu lengkap) untuk fallback bulan/tahun
  const endDate = parseDateId(rawEnd)
  const fallback = endDate ? { month: endDate.getUTCMonth(), year: endDate.getUTCFullYear() } : undefined
  const startDate = parseDateId(rawStart, fallback)

  return { kode, startDate, endDate }
}

/** Ambil daftar periode dari <select id="periode"> pada halaman data-tabular */
export async function scrapePeriods(): Promise<SimotandiPeriodeInfo[]> {
  try {
    const html = await politeText(`${SIMOTANDI_BASE}/data-tabular`)

    const selectStart = html.indexOf('id="periode"')
    if (selectStart < 0) throw new Error('Elemen <select id="periode"> tidak ditemukan')
    const selectEnd = html.indexOf('</select>', selectStart)
    const block = html.slice(selectStart, selectEnd > 0 ? selectEnd : undefined)

    const periods: SimotandiPeriodeInfo[] = []
    const optionRe = /<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g
    let m: RegExpExecArray | null
    while ((m = optionRe.exec(block)) !== null) {
      const id = parseInt(m[1], 10)
      const label = m[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      if (!label || !Number.isFinite(id)) continue
      const { kode, startDate, endDate } = parsePeriodeLabel(label)
      periods.push({ id, kode, label, startDate, endDate })
    }

    if (periods.length === 0) throw new Error('Tidak ada periode yang ter-parse')
    return periods
  } catch (err) {
    // Halaman HTML SIMOTANDI sering 522/403. Pakai daftar periode yang tersimpan
    // agar sinkronisasi data tetap bisa berjalan.
    console.warn('[simotandi] scrape periode gagal, memakai daftar tersimpan:', (err as Error).message)
    return (FALLBACK_PERIODS as any[]).map((p) => ({
      id: p.id,
      kode: p.kode,
      label: p.label,
      startDate: p.startDate ? new Date(p.startDate) : null,
      endDate: p.endDate ? new Date(p.endDate) : null,
    }))
  }
}

/** Daftar kabupaten/kota satu provinsi (untuk validasi/pencarian nama) */
export async function fetchKabupatenList(kdpr: string): Promise<{ kode: string; nama: string }[]> {
  const text = await politeText(`${SIMOTANDI_BASE}/data-tabular/kabupaten?provinsi=${kdpr}`, { json: true })
  const list = JSON.parse(text)
  return (Array.isArray(list) ? list : []).map((x: any) => ({
    kode: String(x.value),
    nama: x.value_label || x.label || String(x.value),
  }))
}

/**
 * Ambil seluruh baris (provinsi + kabupaten + kecamatan) untuk satu provinsi
 * pada satu periode.
 */
export async function fetchProvinceData(periodeId: number, kdpr: string): Promise<SimotandiRow[]> {
  const url = `${SIMOTANDI_BASE}/data-tabular/data?periode=${periodeId}&provinsi=${kdpr}`
  const text = await politeText(url, { json: true })
  const json = JSON.parse(text)
  const data: any[] = Array.isArray(json?.data) ? json.data : []

  const rows: SimotandiRow[] = []
  for (const d of data) {
    const level = String(d.level) as SimotandiLevel
    if (level !== 'provinsi' && level !== 'kabupaten' && level !== 'kecamatan') continue

    const kdkb = d.kdkb ? String(d.kdkb) : null
    const kdkc = d.kdkc ? String(d.kdkc) : null

    rows.push({
      level,
      nama: String(d.name || d.wadmkc || '').trim() || String(kdkc || kdkb || kdpr),
      kdpr: d.kdpr ? String(d.kdpr) : kdpr,
      kdkb,
      kdkc,
      bera: toNumber(d.bera),
      penyiapanLahan: toNumber(d.penyiapan_lahan),
      tanam: toNumber(d.tanam_1_12_hst),
      veg1: toNumber(d.veg_1_13_36_hst),
      veg2: toNumber(d.veg_2_37_60_hst),
      gen1: toNumber(d.gen_1_61_84_hst),
      gen2: toNumber(d.gen_2_85_110_hst),
      panen: toNumber(d.panen),
      standingCrop: toNumber(d.standing_crop),
      lsb: toNumber(d.lsb),
    })
  }

  return rows
}

export { sleep as simotandiSleep }
