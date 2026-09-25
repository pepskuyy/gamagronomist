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

/**
 * Koneksi DB publik (lewat proxy Supabase) kadang timeout. Ulangi operasi
 * yang gagal karena masalah koneksi — aman karena tiap provinsi ditulis
 * dengan pola delete-then-insert (idempoten).
 */
async function withDbRetry(fn, label, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = String(err?.message ?? err)
      const transient = /can't reach database|timeout|ECONNRESET|ECONNREFUSED|P1001|P1002|P1017|connection/i.test(msg)
      if (i === attempts || !transient) throw err
      const delay = 2000 * i
      console.log(`    ${label}: koneksi gagal, retry ${i}/${attempts} dalam ${delay / 1000}s`)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}

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

async function getText(url, json = false, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: json ? HEADERS_JSON : HEADERS_HTML })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const err = new Error(
          `HTTP ${res.status}${body ? ' — ' + body.replace(/\s+/g, ' ').slice(0, 120) : ''}`
        )
        err.status = res.status
        throw err
      }
      return await res.text()
    } catch (err) {
      // Jangan retry untuk 4xx (kecuali 429); retry untuk 5xx / error jaringan
      const retryable = !err.status || err.status >= 500 || err.status === 429
      if (attempt === retries || !retryable) throw err
      const delay = 2000 * Math.pow(2, attempt)
      console.log(`    retry ${attempt + 1}/${retries} dalam ${delay / 1000}s (${String(err.message).slice(0, 60)})`)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
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

const PERIODS_CACHE = path.resolve(process.cwd(), 'src', 'lib', 'simotandi-periods.json')

function loadCachedPeriods() {
  try {
    return JSON.parse(fs.readFileSync(PERIODS_CACHE, 'utf8'))
  } catch {
    return null
  }
}

async function scrapePeriods() {
  try {
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

    // Segarkan cache agar daftar periode tetap mutakhir
    try {
      fs.writeFileSync(PERIODS_CACHE, JSON.stringify(periods, null, 0))
    } catch {}
    return periods
  } catch (err) {
    const cached = loadCachedPeriods()
    if (!cached || cached.length === 0) throw err
    console.warn(`  Halaman SIMOTANDI gagal (${String(err.message).slice(0, 70)})`)
    console.warn(`  Memakai daftar periode tersimpan (${cached.length} periode)\n`)
    return cached
  }
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
  await withDbRetry(
    () =>
      prisma.simotandiPeriode.upsert({
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
      }),
    `upsert ${period.kode}`,
  )

  let totalRows = 0
  for (const kdpr of PROVINCES) {
    const rows = await fetchProvinceData(period.id, kdpr)
    if (rows.length > 0) {
      // delete + insert di dalam satu retry agar idempoten bila koneksi putus
      await withDbRetry(async () => {
        await prisma.simotandiWilayah.deleteMany({ where: { periodeId: period.id, kdpr } })
        await prisma.simotandiWilayah.createMany({
          data: rows.map((r) => ({ ...r, periodeId: period.id })),
        })
      }, `${period.kode}/${kdpr}`)
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
