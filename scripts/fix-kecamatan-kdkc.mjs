/**
 * scripts/fix-kecamatan-kdkc.mjs
 *
 * GADM memberi kode kecamatan yang tidak konsisten dengan BPS (mis.
 * 3307031 = Kalibawang, padahal BPS 330715). Namun NAMA kecamatan cocok.
 *
 * Script ini memetakan nama kecamatan GADM -> kode BPS SIMOTANDI
 * (/data-tabular/kecamatan?kabupaten=...) lalu menulis ulang properti
 * `kdkc` dan `nama` pada GeoJSON kecamatan.
 *
 * Jalankan: node scripts/fix-kecamatan-kdkc.mjs [--write]
 */

import fs from 'node:fs'
import path from 'node:path'

const WRITE = process.argv.includes('--write')
const DIR = path.resolve(process.cwd(), 'public', 'geojson', 'kecamatan')

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchKecamatan(kdkb, attempt = 1) {
  try {
    const res = await fetch(
      `https://simotandi.pertanian.go.id/data-tabular/kecamatan?kabupaten=${kdkb}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    if (attempt >= 3) throw err
    await sleep(2000 * attempt)
    return fetchKecamatan(kdkb, attempt + 1)
  }
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()

let totalFeatures = 0
let matched = 0
let matchedByCode = 0
let dropped = 0
let unmatched = 0
const unmatchedList = []

for (const file of files) {
  const kdkb = file.replace('.json', '')
  const full = path.join(DIR, file)
  const fc = JSON.parse(fs.readFileSync(full, 'utf8'))

  let apiList
  try {
    apiList = await fetchKecamatan(kdkb)
  } catch (err) {
    console.log(`  ${kdkb}: gagal ambil daftar kecamatan (${err.message}) — dilewati`)
    continue
  }

  const byName = new Map()
  const byCode = new Map()
  for (const item of apiList ?? []) {
    const kode = String(item.value)
    const nama = item.value_label || item.label || kode
    byName.set(norm(nama), { kdkc: kode, nama })
    byCode.set(kode, nama)
  }

  const kept = []
  for (const feat of fc.features ?? []) {
    totalFeatures++
    const origCode = String(feat.properties?.kdkc ?? '')

    // Buang fitur non-administratif GADM (waduk/danau), kode berakhiran 888
    if (origCode.endsWith('888')) {
      dropped++
      continue
    }

    const gadmName = feat.properties?.nama ?? ''
    const hit = byName.get(norm(gadmName))

    if (hit) {
      feat.properties.kdkc = hit.kdkc
      feat.properties.nama = hit.nama
      matched++
    } else {
      // Fallback: potong kode 7 digit GADM menjadi 6 digit BPS, bila kode itu ada
      const sliced = origCode.slice(0, 6)
      if (byCode.has(sliced)) {
        feat.properties.kdkc = sliced
        feat.properties.nama = byCode.get(sliced)
        matchedByCode++
      } else {
        unmatched++
        unmatchedList.push(`${kdkb}: "${gadmName}" (kode ${origCode})`)
      }
    }
    kept.push(feat)
  }

  fc.features = kept
  if (WRITE) fs.writeFileSync(full, JSON.stringify(fc))
  await sleep(250)
}

console.log(`file kecamatan   : ${files.length}`)
console.log(`total fitur      : ${totalFeatures}`)
console.log(`cocok nama       : ${matched}`)
console.log(`cocok via kode   : ${matchedByCode}`)
console.log(`dibuang (non-adm): ${dropped}`)
console.log(`tidak cocok      : ${unmatched}`)
if (unmatchedList.length) {
  console.log('\nBelum cocok:')
  for (const u of unmatchedList.slice(0, 40)) console.log('  ' + u)
  if (unmatchedList.length > 40) console.log(`  ... dan ${unmatchedList.length - 40} lainnya`)
}
console.log(WRITE ? '\nPerubahan ditulis.' : '\nDry run — jalankan dengan --write untuk menulis.')
