/**
 * scripts/backfill-simotandi.mjs
 *
 * Backfill data periode SIMOTANDI tahun 2026 (21 periode) ke database produksi
 * dengan memanggil endpoint sync satu periode per request (agar tidak timeout).
 *
 * Prasyarat:
 *   - Tabel sudah dibuat:  npx prisma db push   (dengan DATABASE_URL produksi)
 *   - Aplikasi sudah ter-deploy dan CRON_SECRET sudah di-set di server
 *
 * Pemakaian:
 *   node scripts/backfill-simotandi.mjs https://agrolens.gamaagrosejati.co.id <CRON_SECRET>
 *
 * Atau lewat env:
 *   APP_URL=https://... CRON_SECRET=... node scripts/backfill-simotandi.mjs
 */

const baseUrl = process.argv[2] || process.env.APP_URL
const secret = process.argv[3] || process.env.CRON_SECRET

if (!baseUrl || !secret) {
  console.error('Pemakaian: node scripts/backfill-simotandi.mjs <baseUrl> <CRON_SECRET>')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`Backfill SIMOTANDI dari ${baseUrl}\n`)

  for (let i = 1; i <= 40; i++) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/simotandi-sync?mode=backfill`
    let json

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })
      json = await res.json()
      if (!res.ok) {
        console.error(`  [${i}] HTTP ${res.status}: ${JSON.stringify(json)}`)
        process.exit(1)
      }
    } catch (err) {
      console.error(`  [${i}] Gagal memanggil endpoint: ${err.message}`)
      process.exit(1)
    }

    if (json.remaining === 0 && !json.periode) {
      console.log(`\nSelesai — semua periode 2026 sudah tersinkron.`)
      return
    }

    console.log(
      `  [${i}] ${json.periode?.kode ?? '-'} — ${json.rowsSaved ?? 0} baris, sisa ${json.remaining ?? 0} periode`
    )

    if (!json.periode) {
      console.log('\nTidak ada periode yang perlu disinkronkan.')
      return
    }

    await sleep(1500)
  }

  console.log('\nBatas iterasi tercapai. Jalankan ulang script untuk melanjutkan.')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
