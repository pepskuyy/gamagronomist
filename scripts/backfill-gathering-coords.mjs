/**
 * backfill-gathering-coords.mjs
 *
 * Tujuan    : Mengekstrak koordinat GPS dari watermark foto app "Timemark"
 *             pada laporan Farmer Gathering, lalu mengisi kolom
 *             latitude/longitude di database.
 *
 * Cara kerja: 2-pass OCR
 *   Pass 1 → Crop area bawah-kiri (scale 2x, psm6), ambil word bounding-boxes.
 *             Cari kata kunci "Coordinate" (anchor).
 *   Pass 2 → Crop baris anchor di resolusi native, psm6.
 *             Regex/range-based parse untuk menangani karakter misread.
 *
 * Pemakaian:
 *   node --env-file=.env scripts/backfill-gathering-coords.mjs            # dry-run
 *   node --env-file=.env scripts/backfill-gathering-coords.mjs --write    # tulis ke DB
 *   node --env-file=.env scripts/backfill-gathering-coords.mjs --limit=5
 *   node --env-file=.env scripts/backfill-gathering-coords.mjs --id=<cuid>
 */

import pkg from '@prisma/client'
import { createWorker } from 'tesseract.js'
import sharp from 'sharp'

const { PrismaClient } = pkg
const prisma = new PrismaClient()

// ─── CLI args ────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const WRITE   = args.includes('--write')
const LIMIT   = (() => { const a = args.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : 500 })()
const ONLY_ID = (() => { const a = args.find(x => x.startsWith('--id=')); return a ? a.split('=')[1] : null })()

// ─── Constants ────────────────────────────────────────────────────────────────
// Indonesia bounding box
const LAT_MIN = -11.5, LAT_MAX = 6.5
const LNG_MIN = 94.0,  LNG_MAX = 142.0
const SCALE   = 2      // pass-1 resize factor

// ─── Coordinate parsing ──────────────────────────────────────────────────────
function toNum(s) { return parseFloat(String(s).replace(',', '.')) }
function validCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX
}

/**
 * Parse teks OCR dan kembalikan { lat, lng, raw, valid } atau null.
 * Strategi bertingkat:
 *   1. Regex penuh: lat(N/S) , lng(E/W)
 *   2. Regex penuh: lng(E/W) , lat(N/S) [urutan terbalik]
 *   3. Regex semi: lat(N/S) ada, lng hanya angka (no E/W, pakai range validation)
 *   4. Range-based numeric: cari dua desimal di dekat kata "Coordinate",
 *      validasi pasangan terhadap bounding box Indonesia — fallback paling toleran
 */
function parseCoordinate(text) {
  if (!text) return null
  const t = text.replace(/[\r\n]+/g, ' ')

  // ── strategi 1 & 2: regex penuh ──
  const fullPatterns = [
    { re: /coordinate[^0-9\-]{0,16}(-?\d{1,3}(?:[.,]\d+)?)\s*[°'"]?\s*([NS])[,;\s]+(-?\d{1,3}(?:[.,]\d+)?)\s*[°'"]?\s*([EW])/i, order: 'latlng' },
    { re: /coordinate[^0-9\-]{0,16}(-?\d{1,3}(?:[.,]\d+)?)\s*[°'"]?\s*([EW])[,;\s]+(-?\d{1,3}(?:[.,]\d+)?)\s*[°'"]?\s*([NS])/i, order: 'lnglat' },
    { re: /(-?\d{1,3}[.,]\d{3,8})\s*[°'"]?\s*([NS])[,;\s]+(-?\d{1,3}[.,]\d{3,8})\s*[°'"]?\s*([EW])/i, order: 'latlng' },
  ]
  for (const { re, order } of fullPatterns) {
    const m = t.match(re)
    if (!m) continue
    let lat, lng
    if (order === 'latlng') {
      lat = toNum(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1)
      lng = toNum(m[3]) * (m[4].toUpperCase() === 'W' ? -1 : 1)
    } else {
      lng = toNum(m[1]) * (m[2].toUpperCase() === 'W' ? -1 : 1)
      lat = toNum(m[3]) * (m[4].toUpperCase() === 'S' ? -1 : 1)
    }
    return { lat, lng, raw: m[0].trim(), valid: validCoord(lat, lng) }
  }

  // ── strategi 3: lat ada N/S, lng hanya angka ──
  {
    const m = t.match(/coordinate[^0-9\-]{0,16}(-?\d{1,3}(?:[.,]\d+)?)\s*[°'"]?\s*([NS])[,;\s]+(\d{2,3}[.,]\d+)/i)
    if (m) {
      const lat = toNum(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1)
      const lng = toNum(m[3])   // Indonesia selalu E → positif
      if (validCoord(lat, lng)) return { lat, lng, raw: m[0].trim(), valid: true }
    }
  }

  // ── strategi 4: range-based numeric search ──
  const ci = t.toLowerCase().indexOf('oordinate')
  if (ci !== -1) {
    const snippet = t.slice(ci, ci + 100)
    const hasS = /[Ss]/.test(snippet)
    const nums = [...snippet.matchAll(/\d{1,3}[.,]\d{3,8}/g)].map(m => toNum(m[0]))
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = nums[i], b = nums[j]
        if (a >= 0 && a <= 11.5 && b >= LNG_MIN && b <= LNG_MAX) {
          const lat = hasS ? -a : a
          if (validCoord(lat, b)) return { lat, lng: b, raw: `${a},${b}`, valid: true }
        }
        if (b >= 0 && b <= 11.5 && a >= LNG_MIN && a <= LNG_MAX) {
          const lat = hasS ? -b : b
          if (validCoord(lat, a)) return { lat, lng: a, raw: `${b},${a}`, valid: true }
        }
      }
    }
  }

  return null
}

// ─── TSV word parser ──────────────────────────────────────────────────────────
function parseTsvWords(tsv) {
  return tsv.trim().split('\n').slice(1).flatMap(l => {
    const c = l.split('\t')
    if (c[0] !== '5' || !c[11]?.trim()) return []
    return [{ left: +c[6], top: +c[7], width: +c[8], height: +c[9], conf: +c[10], text: c[11] }]
  })
}

// ─── 2-pass OCR per foto ──────────────────────────────────────────────────────
async function ocrCoordinate(worker, url) {
  let buf
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return null
    buf = Buffer.from(await res.arrayBuffer())
  } catch { return null }

  let meta
  try { meta = await sharp(buf).metadata() } catch { return null }
  const W = meta.width  || 1280
  const H = meta.height || 960

  // ── PASS 1: scan area bawah-kiri di 2×, dapatkan bbox kata "Coordinate" ──
  const P1_TOP = Math.floor(H * 0.45)
  const P1_CW  = Math.floor(W * 0.82)
  const P1_CH  = H - P1_TOP

  let d1
  try {
    const crop1 = await sharp(buf)
      .extract({ left: 0, top: P1_TOP, width: P1_CW, height: P1_CH })
      .grayscale().normalize()
      .resize({ width: P1_CW * SCALE, kernel: 'lanczos3' })
      .png().toBuffer()
    ;({ data: d1 } = await worker.recognize(crop1, { tessedit_pageseg_mode: '6' }, { tsv: true }))
  } catch { return null }

  const words  = parseTsvWords(String(d1.tsv || ''))
  const anchor = words.find(w => /oordinate/i.test(w.text))
  if (!anchor) return null   // foto tanpa watermark Timemark

  // Gabungkan semua kata pada baris anchor
  const lineWords = words.filter(w => Math.abs(w.top - anchor.top) < anchor.height * 0.7)
  const minX = Math.min(...lineWords.map(w => w.left))
  const maxX = Math.max(...lineWords.map(w => w.left + w.width))
  const minY = Math.min(...lineWords.map(w => w.top))
  const maxY = Math.max(...lineWords.map(w => w.top + w.height))

  // ── PASS 2: re-crop baris anchor di native (1:1) resolusi ──
  const aH = Math.ceil((maxY - minY) / SCALE)
  const oL = Math.max(0, Math.floor(minX / SCALE))
  const oT = Math.max(0, P1_TOP + Math.floor(minY / SCALE) - Math.round(aH * 0.5))
  const oW = Math.min(W - oL, Math.ceil((maxX - minX) / SCALE) + 30)
  const oH = Math.min(H - oT, Math.round(aH * 3.5))

  if (oW >= 5 && oH >= 5) {
    try {
      const crop2 = await sharp(buf)
        .extract({ left: oL, top: oT, width: oW, height: oH })
        .grayscale().normalize()
        .png().toBuffer()
      const { data: d2 } = await worker.recognize(crop2, { tessedit_pageseg_mode: '6' })
      const parsed = parseCoordinate(d2.text)
      if (parsed?.valid) return { ...parsed, pass: 2 }
    } catch { /* fall through */ }
  }

  // ── Fallback: regex pada teks pass-1 ──
  const lineTxt = lineWords.map(w => w.text).join(' ')
  const fallback = parseCoordinate(lineTxt)
  if (fallback?.valid) return { ...fallback, pass: 1 }

  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function parsePhotos(s) {
  try { const a = JSON.parse(s ?? '[]'); return Array.isArray(a) ? a.filter(Boolean) : [] }
  catch { return [] }
}

async function main() {
  const where = {}
  if (ONLY_ID) { where.id = ONLY_ID }
  else { where.latitude = null; where.photos = { not: null } }

  const targets = await prisma.farmerGathering.findMany({
    where, orderBy: { createdAt: 'desc' }, take: LIMIT,
    select: { id: true, createdAt: true, photos: true },
  })

  console.log(`\n⚙️  Mode   : ${WRITE ? '✏️  WRITE (update DB)' : '🔎 DRY-RUN'}`)
  console.log(`📋 Target : ${targets.length} laporan farmer gathering\n`)
  if (!WRITE) console.log('ℹ️  Jalankan dengan --write untuk menyimpan ke DB.\n')

  const worker = await createWorker('eng')
  let ok = 0, fail = 0, skip = 0

  for (let i = 0; i < targets.length; i++) {
    const rec    = targets[i]
    const photos = parsePhotos(rec.photos)
    const prefix = `[${String(i + 1).padStart(3)}] ${rec.id}`

    if (photos.length === 0) {
      skip++
      console.log(`${prefix} — ⏭️  tanpa foto`)
      continue
    }

    let found = null
    for (const url of photos) {
      const r = await ocrCoordinate(worker, url)
      if (r?.valid) { found = r; break }
    }

    if (found) {
      ok++
      const src = found.pass === 2 ? '' : '(pass-1 fallback)'
      console.log(`${prefix} — ✅ ${found.lat}, ${found.lng}  "${found.raw}" ${src}`)
      if (WRITE) {
        await prisma.farmerGathering.update({
          where: { id: rec.id },
          data:  { latitude: found.lat, longitude: found.lng },
        })
      }
    } else {
      fail++
      console.log(`${prefix} — ❌ tidak terdeteksi (${photos.length} foto)`)
    }
  }

  await worker.terminate()
  await prisma.$disconnect()

  console.log(`\n─────────────────────────────────────────────────`)
  console.log(`✅ Terdeteksi : ${ok}`)
  console.log(`❌ Tidak ada  : ${fail}   (foto tanpa watermark / bukan Timemark)`)
  console.log(`⏭️ Tanpa foto : ${skip}`)
  if (WRITE) console.log('\n✅ Data tersimpan ke database.')
  else       console.log('\nRerun dengan --write untuk menyimpan ke DB.\n')
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
