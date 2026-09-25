/**
 * scripts/sync-simotandi-local.mjs
 *
 * Sinkronisasi data SIMOTANDI LANGSUNG dari komputer lokal ke database.
 *
 * Dipakai bila server (VPS/Coolify) diblokir SIMOTANDI (HTTP 403) sehingga
 * cron harian di server tidak bisa menarik data. Komputer lokal umumnya
 * tidak diblokir, jadi script ini yang mengisi database.
 *
 * Pemakaian:
 *   node scripts/sync-simotandi-local.mjs          -> semua periode tahun 2026
 *   node scripts/sync-simotandi-local.mjs 51       -> hanya periode id 51
 *   node scripts/sync-simotandi-local.mjs --latest -> hanya periode terbaru
 *
 * Prasyarat: DATABASE_URL produksi terpasang di file .env
 *
 * Catatan: logika parsing di sini mirror dengan src/lib/simotandi.ts.
 * Jika SIMOTANDI mengubah struktur, perbarui keduanya.
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Muat .env (tanpa dependency tambahan) ─────────────────────────
function loadEnv() {
  const file = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
}
loadEnv()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diset. Isi file .env dengan koneksi produksi.')
  process.exit(1)
}

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

// ── Konstanta & helper ────────────────────────────────────────────
const BASE = 'https://simotandi.pertanian.go.id'
const PROVINCES = ['33', '34', '35']

const MONTHS_ID = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HEADERS_HTML = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: `${BASE}/data-tabular`,
  'Upgrade-Insecure-Requests': '1',
}

const HEADERS_JSON = {
  ...HEADERS_HTML,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
}

async function getText(url, json = false) {
  const res = await fetch(url, { headers: json ? HEADERS_JSON : HEADERS_HTML })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} — ${body.replace(/\s+/g, ' ').slice(0, 180)}`)
  }
  return res.text()
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function parseDateId(text, fallback) {
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
    if (Number.isFinite(day)) return new Date(Date.UTC(fallback.year, fallback.month, day))
  }
  return null
}

function parsePeriodeLabel(label) {
  const [kodePart, rangePart] = label.split('|').map((s) => s.trim())
  const kode = kodePart ?? ''
  if (!rangePart || !rangePart.includes('-')) return { kode, startDate: null, endDate: null }
  const [rawStart, rawEnd] = rangePart.split(' - ').map((s) => s.trim())
  const endDate = parseDateId(rawEnd)
  const fallback = endDate ? { month: endDate.getUTCMonth(), year: endDate.getUTCFullYear() } : undefined
  return { kode, startDate: parseDateId(rawStart, fallback), endDate }
}

async function scrapePeriods() {
  const html = await getText(`${BASE}/data-tabular`)
  const start = html.indexOf('id="periode"')
  if (start < 0) throw new Error('Elemen <select id="periode"> tidak ditemukan')
  const end = html.indexOf('</select>', start)
  const block = html.slice(start, end > 0 ? end : undefined)

  const periods = []
  const re = /<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g
  let m
  while ((m = re.exec(block)) !== null) {
    const id = parseInt(m[1], 10)
    const label = m[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (!label || !Number.isFinite(id)) continue
    periods.push({ id, label, ...parsePeriodeLabel(label) })
  }
  if (periods.length === 0) throw new Error('Tidak ada periode yang ter-parse')
  return periods
}

async function fetchProvinceData(periodeId, kdpr) {
  const text = await getText(`${BASE}/data-tabular/data?periode=${periodeId}&provinsi=${kdpr}`, true)
  const json = JSON.parse(text)
  const data = Array.isArray(json?.data) ? json.data : []

  const rows = []
  for (const d of data) {
    const level = String(d.level)
    if (!['provinsi', 'kabupaten', 'kecamatan'].includes(level)) continue
    rows.push({
      level,
      nama: String(d.name || d.wadmkc || '').trim() || String(d.kdkc || d.kdkb || kdpr),
      kdpr: d.kdpr ? String(d.kdpr) : kdpr,
      kdkb: d.kdkb ? String(d.kdkb) : null,
      kdkc: d.kdkc ? String(d.kdkc) : null,
      bera: num(d.bera),
      penyiapanLahan: num(d.penyiapan_lahan),
      tanam: num(d.tanam_1_12_hst),
      veg1: num(d.veg_1_13_36_hst),
      veg2: num(d.veg_2_37_60_hst),
      gen1: num(d.gen_1_61_84_hst),
      gen2: num(d.gen_2_85_110_hst),
      panen: num(d.panen),
      standingCrop: num(d.standing_crop),
      lsb: num(d.lsb),
    })
  }
  return rows
}

async function syncPeriod(period, index, total) {
  await prisma.simotandiPeriode.upsert({
    where: { id: period.id },
    update: {
      kode: period.kode,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      syncedAt: new Date(),
    },
    create: {
      id: period.id,
      kode: period.kode,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
    },
  })

  let totalRows = 0
  for (const kdpr of PROVINCES) {
    const rows = await fetchProvinceData(period.id, kdpr)
    if (rows.length > 0) {
      await prisma.simotandiWilayah.deleteMany({ where: { periodeId: period.id, kdpr } })
      await prisma.simotandiWilayah.createMany({
        data: rows.map((r) => ({ ...r, periodeId: period.id })),
      })
      totalRows += rows.length
    }
    await sleep(1000)
  }

  console.log(`  [${index}/${total}] ${period.kode} — ${totalRows} baris`)
}

async function main() {
  const arg = process.argv[2]

  console.log(`Target DB: ${process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@')}\n`)
  console.log('Mengambil daftar periode dari SIMOTANDI...')
  const all = await scrapePeriods()
  console.log(`  ${all.length} periode ditemukan\n`)

  let targets
  if (!arg) {
    targets = all.filter((p) => p.kode.startsWith('2026')).sort((a, b) => a.kode.localeCompare(b.kode))
    console.log(`Mode: semua periode 2026 (${targets.length} periode)`)
  } else if (arg === '--latest') {
    targets = [all.reduce((a, b) => (a.id > b.id ? a : b))]
    console.log(`Mode: periode terbaru (${targets[0].kode})`)
  } else {
    const id = parseInt(arg, 10)
    const found = all.find((p) => p.id === id)
    if (!found) {
      console.error(`Periode id ${id} tidak ditemukan`)
      process.exit(1)
    }
    targets = [found]
    console.log(`Mode: periode tunggal (${found.kode})`)
  }

  console.log('')
  let i = 0
  for (const p of targets) {
    i++
    await syncPeriod(p, i, targets.length)
  }

  console.log('\nSelesai.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('\nFATAL:', err.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
