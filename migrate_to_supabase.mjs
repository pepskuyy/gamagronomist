/**
 * migrate_to_supabase.mjs
 * 
 * Script migrasi data dari CSV (export Neon) ke Supabase.
 * Jalankan: node migrate_to_supabase.mjs
 * 
 * Pastikan folder migration_csv/ berisi file CSV hasil export Neon SQL Editor.
 */

import { createReadStream, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pg'

const { Pool } = pkg

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Konfigurasi Supabase ────────────────────────────────────────────
const SUPABASE_URL = 'postgresql://postgres.wfgarxbunoltnatyktmb:Gas3208161180@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
const CSV_DIR = join(__dirname, 'migration_csv')

// ─── Urutan tabel (harus ikut FK constraint) ─────────────────────────
const TABLE_ORDER = [
  'User',              // self-referential, handle khusus
  'Product',
  'Farmer',
  'Store',
  'Request',
  'RequestDetail',
  'DemoPlot',
  'DemoPlotDetail',
  'Ledger',
  'SampleLedger',
  'CustomerBehavior',
  'SpotDemplot',
  'SpotDemplotDetail',
  'StockOpname',
  'OpnameDetail',
  'ContentVideo',
  'ContentVideoProduct',
  'VisitKios',
  'VisitCompany',
  'FarmerGathering',
  'KpiTarget',
  'Notification',
  'AccountRequest',
]

// ─── Parse CSV sederhana (handle quoted fields) ───────────────────────
function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const headers = parseRow(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    if (values.length !== headers.length) continue
    const row = {}
    headers.forEach((h, idx) => {
      const v = values[idx]
      row[h.trim()] = (v === '' || v === 'NULL' || v === 'null') ? null : v
    })
    rows.push(row)
  }
  return { headers: headers.map(h => h.trim()), rows }
}

// ─── Baca file CSV ────────────────────────────────────────────────────
async function readFile(filePath) {
  const { readFile } = await import('fs/promises')
  return readFile(filePath, 'utf-8')
}

// ─── Insert batch ke Supabase ─────────────────────────────────────────
async function insertBatch(pool, tableName, headers, rows) {
  if (rows.length === 0) return 0

  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const cols = headers.map(h => `"${h}"`).join(', ')
    const placeholders = batch.map((_, bi) =>
      '(' + headers.map((_, ci) => `$${bi * headers.length + ci + 1}`).join(', ') + ')'
    ).join(', ')

    const values = batch.flatMap(row => headers.map(h => row[h]))

    try {
      await pool.query(
        `INSERT INTO "${tableName}" (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      )
      inserted += batch.length
    } catch (err) {
      console.error(`  ⚠️  Batch error di ${tableName} (row ${i}-${i + batch.length}):`, err.message)
    }
  }
  return inserted
}

// ─── Handle User (self-referential FK: afaId → User.id) ──────────────
async function migrateUsers(pool, rows, headers) {
  // Step 1: Insert semua user dengan afaId = NULL dulu
  const headersNoAfa = headers.filter(h => h !== 'afaId')
  const rowsNoAfa = rows.map(r => {
    const { afaId, ...rest } = r
    return rest
  })

  const cols = headersNoAfa.map(h => `"${h}"`).join(', ')
  let inserted = 0
  for (const row of rowsNoAfa) {
    const vals = headersNoAfa.map(h => row[h])
    const placeholders = headersNoAfa.map((_, i) => `$${i + 1}`).join(', ')
    try {
      await pool.query(
        `INSERT INTO "User" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        vals
      )
      inserted++
    } catch (err) {
      console.error(`  ⚠️  User insert error:`, err.message)
    }
  }

  // Step 2: Update afaId yang bukan null
  let updated = 0
  for (const row of rows) {
    if (row.afaId) {
      try {
        await pool.query(`UPDATE "User" SET "afaId" = $1 WHERE id = $2`, [row.afaId, row.id])
        updated++
      } catch (err) {
        console.error(`  ⚠️  afaId update error for ${row.id}:`, err.message)
      }
    }
  }
  return { inserted, updated }
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(CSV_DIR)) {
    console.error(`❌ Folder migration_csv tidak ditemukan di: ${CSV_DIR}`)
    console.error('   Buat folder dan isi dengan CSV hasil export Neon SQL Editor.')
    process.exit(1)
  }

  console.log('🚀 Memulai migrasi data ke Supabase...\n')

  const pool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } })

  // Test koneksi
  try {
    await pool.query('SELECT 1')
    console.log('✅ Koneksi ke Supabase berhasil\n')
  } catch (err) {
    console.error('❌ Gagal koneksi ke Supabase:', err.message)
    process.exit(1)
  }

  // Disable FK checks sementara
  await pool.query('SET session_replication_role = replica')
  console.log('⚡ FK constraints dinonaktifkan sementara\n')

  const availableFiles = readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'))
  console.log(`📂 Ditemukan ${availableFiles.length} file CSV: ${availableFiles.join(', ')}\n`)

  let totalInserted = 0
  const results = []

  for (const tableName of TABLE_ORDER) {
    // Cari file CSV untuk tabel ini (case-insensitive)
    const csvFile = availableFiles.find(
      f => f.toLowerCase() === `${tableName.toLowerCase()}.csv`
    )

    if (!csvFile) {
      console.log(`⏭️  ${tableName}: tidak ada file CSV, dilewati`)
      continue
    }

    const filePath = join(CSV_DIR, csvFile)
    const content = await readFile(filePath)
    const { headers, rows } = parseCSV(content)

    if (rows.length === 0) {
      console.log(`⏭️  ${tableName}: data kosong, dilewati`)
      continue
    }

    process.stdout.write(`📥 ${tableName}: ${rows.length} baris... `)

    try {
      let inserted
      if (tableName === 'User') {
        const res = await migrateUsers(pool, rows, headers)
        inserted = res.inserted
        console.log(`✅ ${inserted} inserted, ${res.updated} afaId updated`)
      } else {
        inserted = await insertBatch(pool, tableName, headers, rows)
        console.log(`✅ ${inserted} inserted`)
      }
      totalInserted += inserted
      results.push({ table: tableName, rows: rows.length, inserted })
    } catch (err) {
      console.log(`❌ Error: ${err.message}`)
      results.push({ table: tableName, rows: rows.length, inserted: 0, error: err.message })
    }
  }

  // Re-enable FK checks
  await pool.query('SET session_replication_role = DEFAULT')
  console.log('\n⚡ FK constraints diaktifkan kembali')

  await pool.end()

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log('📊 RINGKASAN MIGRASI')
  console.log('═'.repeat(50))
  results.forEach(r => {
    const status = r.error ? '❌' : '✅'
    console.log(`${status} ${r.table.padEnd(25)} ${r.inserted}/${r.rows} baris`)
  })
  console.log('═'.repeat(50))
  console.log(`\n🎉 Total: ${totalInserted} baris berhasil dimigrasi ke Supabase!`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
