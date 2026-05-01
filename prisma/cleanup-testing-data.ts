/**
 * SCRIPT CLEANUP DATA TESTING
 * ============================================================
 * Script ini menghapus SEMUA data transaksi/aktivitas (data testing)
 * sambil MEMPERTAHANKAN:
 *   ✅ User (akun pengguna)
 *   ✅ Area & AreaCoverage
 *   ✅ Product (produk dari Accurate)
 *   ✅ Store / Kios
 *   ✅ KpiTarget (target per area)
 *   ✅ SystemConfig (konfigurasi WAHA dll)
 *   ✅ AccountRequest (yang masih PENDING)
 *
 * Yang akan DIHAPUS:
 *   🗑️ Ledger               — stok transaksi (gudang utama)
 *   🗑️ SampleLedger         — stok transaksi gudang sampel SPV
 *   🗑️ Request + RequestDetail — pengajuan stok
 *   🗑️ DemoPlot + DemoPlotDetail — data demo plot
 *   🗑️ StockOpname + OpnameDetail — data opname
 *   🗑️ CustomerBehavior     — laporan perilaku petani
 *   🗑️ VisitKios            — laporan kunjungan kios
 *   🗑️ FarmerGathering      — laporan gathering
 *   🗑️ VisitCompany         — laporan kunjungan perusahaan
 *   🗑️ SpotDemplot + SpotDemplotDetail — spot demplot
 *   🗑️ Notification         — semua notifikasi
 *   🗑️ Farmer               — data petani (terhubung ke request testing)
 *   🗑️ AccountRequest APPROVED/REJECTED — request akun yang sudah diproses
 * ============================================================
 * Untuk menjalankan:
 *   npx tsx prisma/cleanup-testing-data.ts
 * ============================================================
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Mengecek jumlah data sebelum cleanup...\n')

  // ── Count data ──────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.ledger.count(),
    prisma.sampleLedger.count(),
    prisma.requestDetail.count(),
    prisma.request.count(),
    prisma.demoPlotDetail.count(),
    prisma.demoPlot.count(),
    prisma.opnameDetail.count(),
    prisma.stockOpname.count(),
    prisma.customerBehavior.count(),
    prisma.visitKios.count(),
    prisma.farmerGathering.count(),
    prisma.visitCompany.count(),
    prisma.spotDemplotDetail.count(),
    prisma.spotDemplot.count(),
    prisma.notification.count(),
    prisma.farmer.count(),
    prisma.accountRequest.count({ where: { status: { in: ['APPROVED', 'REJECTED'] } } }),
  ])

  const labels = [
    'Ledger (stok transaksi)',
    'SampleLedger (gudang sampel)',
    'RequestDetail',
    'Request (pengajuan stok)',
    'DemoPlotDetail',
    'DemoPlot',
    'OpnameDetail',
    'StockOpname',
    'CustomerBehavior',
    'VisitKios',
    'FarmerGathering',
    'VisitCompany',
    'SpotDemplotDetail',
    'SpotDemplot',
    'Notification',
    'Farmer',
    'AccountRequest (APPROVED/REJECTED)',
  ]

  let totalRows = 0
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Tabel                              Jumlah Data')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  counts.forEach((c, i) => {
    totalRows += c
    console.log(`  ${labels[i].padEnd(34)} ${c.toString().padStart(6)} baris`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  TOTAL                              ${totalRows.toString().padStart(6)} baris\n`)

  // ── Konfirmasi ──────────────────────────────────────────────
  const args = process.argv.slice(2)
  const confirmed = args.includes('--confirm')

  if (!confirmed) {
    console.log('⚠️  DRY RUN — Tidak ada yang dihapus.')
    console.log('   Untuk eksekusi penghapusan sungguhan, jalankan:')
    console.log('   npx tsx prisma/cleanup-testing-data.ts --confirm\n')
    return
  }

  // ── Eksekusi Penghapusan ────────────────────────────────────
  console.log('🚀 Mulai menghapus data testing...\n')

  await prisma.$transaction([
    // Hapus detail dulu (FK constraints)
    prisma.ledger.deleteMany({}),
    prisma.sampleLedger.deleteMany({}),
    prisma.opnameDetail.deleteMany({}),
    prisma.stockOpname.deleteMany({}),
    prisma.demoPlotDetail.deleteMany({}),
    prisma.spotDemplotDetail.deleteMany({}),
    prisma.requestDetail.deleteMany({}),
  ])

  // Hapus parent records setelah children dihapus
  await prisma.$transaction([
    prisma.demoPlot.deleteMany({}),
    prisma.spotDemplot.deleteMany({}),
    prisma.request.deleteMany({}),
    prisma.customerBehavior.deleteMany({}),
    prisma.visitKios.deleteMany({}),
    prisma.farmerGathering.deleteMany({}),
    prisma.visitCompany.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.farmer.deleteMany({}),
    prisma.accountRequest.deleteMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } }
    }),
  ])

  console.log('✅ Semua data testing berhasil dihapus!\n')

  // ── Verifikasi Akhir ────────────────────────────────────────
  const [userCount, productCount, storeCount, areaCount] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.store.count(),
    prisma.area.count(),
  ])

  console.log('📦 Master data yang tersisa (tidak terhapus):')
  console.log(`   User    : ${userCount} akun`)
  console.log(`   Product : ${productCount} produk`)
  console.log(`   Store   : ${storeCount} kios/toko`)
  console.log(`   Area    : ${areaCount} area`)
  console.log('\n🎉 Database siap untuk penggunaan production!')
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
