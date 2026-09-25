/**
 * scripts/build-geojson.mjs
 *
 * Membangun GeoJSON batas wilayah (kabupaten + kecamatan) untuk provinsi
 * Jawa Tengah (33), DI Yogyakarta (34), dan Jawa Timur (35) dari data GADM 4.1.
 *
 * GADM menyimpan kode BPS di properti CC_1 / CC_2 / CC_3 sehingga hasilnya
 * bisa di-join 1:1 dengan data SIMOTANDI (kdkb / kdkc).
 *
 * Output:
 *   public/geojson/kabupaten.geojson      -> 78 kabupaten (MultiPolygon)
 *   public/geojson/kecamatan/<kdkb>.json  -> batas kecamatan per kabupaten (lazy load)
 *   public/geojson/index.json             -> metadata + bbox per kabupaten
 *
 * Jalankan:  node scripts/build-geojson.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mapshaper = require('mapshaper')

const GADM_BASE = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json'
const SIMOTANDI  = 'https://simotandi.pertanian.go.id'

const PROVINCES = ['33', '34', '35']
// Waduk Kedungombo: fitur non-administratif di GADM, tidak ada di BPS/SIMOTANDI
const EXCLUDE_KAB = new Set(['3388'])

const SIMPLIFY_KABUPATEN  = '10%'
const SIMPLIFY_KECAMATAN  = '25%'
const OUTPUT_PRECISION    = '0.00001'

const ROOT    = path.resolve(process.cwd())
const OUT_DIR = path.join(ROOT, 'public', 'geojson')
const KEC_DIR = path.join(OUT_DIR, 'kecamatan')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, { retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Agrolens-GeoJSON-Builder/1.0' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`  retry ${attempt + 1}/${retries} ${url}: ${err.message}`)
      await sleep(1500)
    }
  }
}

function runMapshaper(geojson, commands) {
  return new Promise((resolve, reject) => {
    mapshaper.applyCommands(
      `-i in.json ${commands} -o out.json`,
      { 'in.json': JSON.stringify(geojson) },
      (err, output) => {
        if (err) return reject(err)
        try {
          resolve(JSON.parse(output['out.json']))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

function bboxOfGeometry(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      return
    }
    for (const c of coords) walk(c)
  }

  if (geometry) walk(geometry.coordinates)
  if (!Number.isFinite(minX)) return null
  return [minX, minY, maxX, maxY]
}

/** Ambil nama kabupaten resmi dari SIMOTANDI (punya spasi, mis. "Kota Magelang") */
async function fetchSimotandiKabupaten(provinsi) {
  try {
    const list = await fetchJson(`${SIMOTANDI}/data-tabular/kabupaten?provinsi=${provinsi}`)
    const map = new Map()
    for (const item of list ?? []) {
      if (item?.value) map.set(String(item.value), item.value_label || item.label || String(item.value))
    }
    return map
  } catch (err) {
    console.warn(`  Gagal ambil daftar kabupaten SIMOTANDI provinsi ${provinsi}: ${err.message}`)
    return new Map()
  }
}

async function main() {
  console.log('=== Build GeoJSON batas wilayah (Jateng, DIY, Jatim) ===\n')

  await fs.mkdir(KEC_DIR, { recursive: true })

  console.log('1. Ambil nama kabupaten dari SIMOTANDI (untuk label tampilan)')
  const nameByKode = new Map()
  for (const prov of PROVINCES) {
    const map = await fetchSimotandiKabupaten(prov)
    for (const [k, v] of map) nameByKode.set(k, v)
    console.log(`   provinsi ${prov}: ${map.size} kabupaten`)
    await sleep(300)
  }

  console.log('\n2. Download GADM level 2 (kabupaten) & level 3 (kecamatan)')
  const [gadm2, gadm3] = await Promise.all([
    fetchJson(`${GADM_BASE}/gadm41_IDN_2.json`),
    fetchJson(`${GADM_BASE}/gadm41_IDN_3.json`),
  ])
  console.log(`   level 2: ${gadm2.features.length} fitur`)
  console.log(`   level 3: ${gadm3.features.length} fitur`)

  // Catatan: GADM level 2 hanya punya CC_2, level 3 hanya punya CC_3.
  // Kode provinsi = 2 digit pertama, kode kabupaten = 4 digit pertama.
  console.log('\n3. Filter ke 3 provinsi')
  const kabFeatures = gadm2.features.filter(
    (f) => PROVINCES.includes(String(f.properties.CC_2).slice(0, 2)) && !EXCLUDE_KAB.has(String(f.properties.CC_2))
  )
  const kecFeatures = gadm3.features.filter(
    (f) =>
      PROVINCES.includes(String(f.properties.CC_3).slice(0, 2)) &&
      !EXCLUDE_KAB.has(String(f.properties.CC_3).slice(0, 4))
  )
  console.log(`   kabupaten: ${kabFeatures.length}`)
  console.log(`   kecamatan: ${kecFeatures.length}`)

  console.log('\n4. Bangun kabupaten.geojson (simplify ' + SIMPLIFY_KABUPATEN + ')')
  const kabClean = {
    type: 'FeatureCollection',
    features: kabFeatures.map((f) => {
      const kdkb = String(f.properties.CC_2)
      return {
        type: 'Feature',
        properties: {
          kdkb,
          nama: nameByKode.get(kdkb) || String(f.properties.NAME_2 || '').replace(/([a-z])([A-Z])/g, '$1 $2'),
          kdpr: kdkb.slice(0, 2),
        },
        geometry: f.geometry,
      }
    }),
  }

  const kabSimplified = await runMapshaper(
    kabClean,
    `-simplify ${SIMPLIFY_KABUPATEN} keep-shapes -o precision=${OUTPUT_PRECISION}`
  )
  const kabOut = path.join(OUT_DIR, 'kabupaten.geojson')
  await fs.writeFile(kabOut, JSON.stringify(kabSimplified))
  const kabSize = (await fs.stat(kabOut)).size
  console.log(`   -> ${path.relative(ROOT, kabOut)} (${(kabSize / 1024).toFixed(1)} KB)`)

  console.log('\n5. Bangun batas kecamatan per kabupaten (simplify ' + SIMPLIFY_KECAMATAN + ')')
  const byKab = new Map()
  for (const f of kecFeatures) {
    const kdkb = String(f.properties.CC_3).slice(0, 4)
    if (!byKab.has(kdkb)) byKab.set(kdkb, [])
    byKab.get(kdkb).push(f)
  }

  const indexEntries = []
  let kecTotalBytes = 0

  for (const kab of kabSimplified.features) {
    const kdkb = kab.properties.kdkb
    const features = byKab.get(kdkb) ?? []

    const kecClean = {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        properties: {
          kdkc: String(f.properties.CC_3),
          nama: String(f.properties.NAME_3 || '').replace(/([a-z])([A-Z])/g, '$1 $2'),
        },
        geometry: f.geometry,
      })),
    }

    let output = kecClean
    if (features.length > 0) {
      try {
        output = await runMapshaper(kecClean, `-simplify ${SIMPLIFY_KECAMATAN} keep-shapes -o precision=${OUTPUT_PRECISION}`)
      } catch (err) {
        console.warn(`   simplify gagal ${kdkb}: ${err.message} — pakai geometri asli`)
      }
    }

    const file = path.join(KEC_DIR, `${kdkb}.json`)
    const text = JSON.stringify(output)
    await fs.writeFile(file, text)
    kecTotalBytes += Buffer.byteLength(text)

    indexEntries.push({
      kdkb,
      kdpr: kab.properties.kdpr,
      nama: kab.properties.nama,
      bbox: bboxOfGeometry(kab.geometry),
      jumlahKecamatan: output.features?.length ?? 0,
    })
  }

  indexEntries.sort((a, b) => a.kdkb.localeCompare(b.kdkb))
  const indexOut = path.join(OUT_DIR, 'index.json')
  await fs.writeFile(indexOut, JSON.stringify(indexEntries, null, 0))

  console.log(`   -> ${byKab.size} file kecamatan (${(kecTotalBytes / 1024).toFixed(1)} KB total)`)
  console.log(`   -> ${path.relative(ROOT, indexOut)} (${indexEntries.length} entri)`)

  console.log('\n6. Validasi vs SIMOTANDI')
  let mismatch = 0
  for (const prov of PROVINCES) {
    const simotandi = await fetchSimotandiKabupaten(prov)
    const gadmCodes = new Set(
      kabSimplified.features.filter((f) => f.properties.kdpr === prov).map((f) => f.properties.kdkb)
    )
    for (const kode of simotandi.keys()) {
      if (!gadmCodes.has(kode)) {
        console.warn(`   MISMATCH: kabupaten ${kode} (${simotandi.get(kode)}) ada di SIMOTANDI, tidak ada di GADM`)
        mismatch++
      }
    }
    for (const kode of gadmCodes) {
      if (!simotandi.has(kode)) {
        console.warn(`   MISMATCH: kabupaten ${kode} ada di GADM, tidak ada di SIMOTANDI`)
        mismatch++
      }
    }
    await sleep(300)
  }
  console.log(mismatch === 0 ? '   OK — semua kode kabupaten cocok' : `   ${mismatch} mismatch ditemukan`)

  console.log('\n=== Selesai ===')
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
