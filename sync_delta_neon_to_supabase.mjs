/**
 * sync_delta_neon_to_supabase.mjs
 * 
 * Script untuk sinkronisasi data dari Neon ke Supabase.
 * Menggunakan metode UPSERT (Insert or Update) berdasarkan Primary Key "id".
 * Tidak akan ada data ganda (duplikat) dan data lama yang berubah akan di-update.
 */

import pkg from 'pg'
const { Pool } = pkg

// ─── KONFIGURASI KONEKSI ──────────────────────────────────────────────
// MASUKKAN CONNECTION STRING NEON ANDA DI BAWAH INI (Yang berakhiran aws.neon.tech)
const NEON_URL = 'postgresql://neondb_owner:npg_CUVomqszxr23@ep-red-tooth-an00eshk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

// Connection string Supabase (Transaction Pooler / Session Pooler)
const SUPABASE_URL = 'postgresql://postgres.wfgarxbunoltnatyktmb:Gas3208161180@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'

// ─── Urutan Tabel (Berdasarkan FK Constraint Schema Anda) ──────────────
const TABLE_ORDER = [
  'User',
  'Area',
  'AreaCoverage',
  'Store',
  'SystemConfig',
  'Product',
  'Farmer',
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

async function syncTable(neonPool, supaPool, tableName) {
  try {
    // 1. Ambil semua data dari Neon
    const { rows, fields } = await neonPool.query(`SELECT * FROM "${tableName}"`)
    if (rows.length === 0) {
      console.log(`⏭️  ${tableName}: Tidak ada data di Neon`)
      return 0
    }

    const headers = fields.map(f => f.name)
    const BATCH_SIZE = 500 // Batch upsert 500 baris per eksekusi
    let upserted = 0

    // Siapkan klausa UPDATE untuk UPSERT (menimpa kolom lama dengan kolom baru)
    const updateSet = headers.map(h => `"${h}" = EXCLUDED."${h}"`).join(', ')
    const cols = headers.map(h => `"${h}"`).join(', ')

    // 2. Lakukan Upsert ke Supabase
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      
      const placeholders = batch.map((_, bi) =>
        '(' + headers.map((_, ci) => `$${bi * headers.length + ci + 1}`).join(', ') + ')'
      ).join(', ')

      const values = batch.flatMap(row => headers.map(h => row[h]))

      const query = `
        INSERT INTO "${tableName}" (${cols}) 
        VALUES ${placeholders} 
        ON CONFLICT (id) DO UPDATE SET ${updateSet}
      `
      
      await supaPool.query(query, values)
      upserted += batch.length
    }

    console.log(`✅ ${tableName}: Sukses sinkronisasi ${upserted} baris`)
    return upserted
  } catch (err) {
    console.error(`❌ Error pada tabel ${tableName}:`, err.message)
    return 0
  }
}

async function main() {
  if (NEON_URL === 'GANTI_DENGAN_URL_NEON_ANDA_DISINI') {
    console.error('❌ HARAP EDIT FILE INI: Masukkan connection string NEON Anda terlebih dahulu di baris ke-12.')
    process.exit(1)
  }

  console.log('🚀 Memulai Sinkronisasi Delta (Neon -> Supabase)...\n')

  const neonPool = new Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } })
  const supaPool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } })

  try {
    await neonPool.query('SELECT 1')
    console.log('✅ Terhubung ke database Neon (Sumber)')
    await supaPool.query('SELECT 1')
    console.log('✅ Terhubung ke database Supabase (Tujuan)\n')
  } catch (err) {
    console.error('❌ Gagal terhubung ke database:', err.message)
    process.exit(1)
  }

  // Disable FK checks di Supabase sementara proses sync berjalan (mencegah error constraint referensi acak)
  await supaPool.query('SET session_replication_role = replica')
  console.log('⚡ FK constraints dimatikan sementara di Supabase...\n')

  let totalSync = 0
  for (const tableName of TABLE_ORDER) {
    process.stdout.write(`📥 Membaca ${tableName}... `)
    const count = await syncTable(neonPool, supaPool, tableName)
    totalSync += count
  }

  // Aktifkan kembali FK checks
  await supaPool.query('SET session_replication_role = DEFAULT')
  console.log('\n⚡ FK constraints diaktifkan kembali.')

  await neonPool.end()
  await supaPool.end()

  console.log(`\n🎉 SELESAI! Total ${totalSync} baris berhasil disinkronkan.`)
  console.log('Web Anda sekarang aman untuk sepenuhnya dialihkan ke Supabase.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
