/**
 * Data migration script (FAST version) — restore branch → main database
 * Uses createMany with skipDuplicates for speed
 * 
 * Run: node migrate-data.js
 */

const { PrismaClient } = require('@prisma/client')

const SOURCE_URL = "postgresql://neondb_owner:npg_CUVomqszxr23@ep-icy-flower-an6xgtrl-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
const TARGET_URL = "postgresql://neondb_owner:npg_CUVomqszxr23@ep-red-tooth-an00eshk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

const src = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } })
const tgt = new PrismaClient({ datasources: { db: { url: TARGET_URL } } })

function section(title) { console.log(`\n━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━`) }

async function bulk(label, fetchFn, createFn) {
  section(label)
  const rows = await fetchFn()
  if (rows.length === 0) { console.log(`  — 0 records, skip`); return [] }
  const result = await createFn(rows)
  console.log(`  ✅ ${rows.length} ${label} (inserted: ${result?.count ?? '?'})`)
  return rows
}

async function migrate() {
  console.log('🚀 Migrasi data (FAST) — SOURCE → TARGET\n')

  try {

    // ── Area ──────────────────────────────────────────────────────────
    const areas = await src.area.findMany()
    section('Area')
    await tgt.area.createMany({
      data: areas.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      skipDuplicates: true
    })
    console.log(`  ✅ ${areas.length} area`)

    // ── User (pass 1 — no afaId) ─────────────────────────────────────
    const users = await src.user.findMany()
    section('User')
    await tgt.user.createMany({
      data: users.map(r => ({
        id: r.id, username: r.username, password: r.password,
        name: r.name, role: r.role, isActive: r.isActive,
        areaId: r.areaId, afaId: null,  // set afaId after
        createdAt: r.createdAt, updatedAt: r.updatedAt,
      })),
      skipDuplicates: true
    })
    // Pass 2 — set afaId FK
    for (const r of users.filter(u => u.afaId)) {
      await tgt.user.update({ where: { id: r.id }, data: { afaId: r.afaId } }).catch(() => null)
    }
    console.log(`  ✅ ${users.length} user`)

    // ── AreaCoverage ─────────────────────────────────────────────────
    const coverages = await src.areaCoverage.findMany()
    section('AreaCoverage')
    await tgt.areaCoverage.createMany({
      data: coverages.map(r => ({ id: r.id, areaId: r.areaId, kabupatenName: r.kabupatenName, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      skipDuplicates: true
    })
    console.log(`  ✅ ${coverages.length} coverage`)

    // ── Product ──────────────────────────────────────────────────────
    const products = await src.product.findMany()
    section('Product')
    await tgt.product.createMany({ data: products, skipDuplicates: true })
    console.log(`  ✅ ${products.length} produk`)

    // ── Store ────────────────────────────────────────────────────────
    const stores = await src.store.findMany()
    section('Store')
    await tgt.store.createMany({ data: stores, skipDuplicates: true })
    console.log(`  ✅ ${stores.length} store`)

    // ── Farmer ───────────────────────────────────────────────────────
    const farmers = await src.farmer.findMany()
    section('Farmer')
    await tgt.farmer.createMany({ data: farmers, skipDuplicates: true })
    console.log(`  ✅ ${farmers.length} petani`)

    // ── Request + RequestDetail ───────────────────────────────────────
    const requests = await src.request.findMany({ include: { details: true } })
    section('Request')
    await tgt.request.createMany({
      data: requests.map(({ details, ...r }) => r),
      skipDuplicates: true
    })
    const allDetails = requests.flatMap(r => r.details)
    if (allDetails.length) await tgt.requestDetail.createMany({ data: allDetails, skipDuplicates: true })
    console.log(`  ✅ ${requests.length} request, ${allDetails.length} detail`)

    // ── DemoPlot + DemoPlotDetail ─────────────────────────────────────
    const demoplots = await src.demoPlot.findMany({ include: { details: true } })
    section('DemoPlot')
    await tgt.demoPlot.createMany({
      data: demoplots.map(({ details, ...d }) => d),
      skipDuplicates: true
    })
    const dpDetails = demoplots.flatMap(d => d.details)
    if (dpDetails.length) await tgt.demoPlotDetail.createMany({ data: dpDetails, skipDuplicates: true })
    console.log(`  ✅ ${demoplots.length} demoplot, ${dpDetails.length} detail`)

    // ── Ledger ───────────────────────────────────────────────────────
    const ledgers = await src.ledger.findMany()
    section('Ledger')
    await tgt.ledger.createMany({ data: ledgers, skipDuplicates: true })
    console.log(`  ✅ ${ledgers.length} ledger`)

    // ── SampleLedger ─────────────────────────────────────────────────
    try {
      const sampleLedgers = await src.sampleLedger.findMany()
      section('SampleLedger')
      await tgt.sampleLedger.createMany({ data: sampleLedgers, skipDuplicates: true })
      console.log(`  ✅ ${sampleLedgers.length} sample ledger`)
    } catch { console.log('  — SampleLedger skip (tidak ada data atau model baru)') }

    // ── CustomerBehavior ─────────────────────────────────────────────
    const cbs = await src.customerBehavior.findMany()
    section('CustomerBehavior')
    await tgt.customerBehavior.createMany({ data: cbs, skipDuplicates: true })
    console.log(`  ✅ ${cbs.length} CB records`)

    // ── VisitKios ────────────────────────────────────────────────────
    const kios = await src.visitKios.findMany()
    section('VisitKios')
    await tgt.visitKios.createMany({ data: kios, skipDuplicates: true })
    console.log(`  ✅ ${kios.length} visit kios`)

    // ── FarmerGathering ──────────────────────────────────────────────
    const gatherings = await src.farmerGathering.findMany()
    section('FarmerGathering')
    await tgt.farmerGathering.createMany({ data: gatherings, skipDuplicates: true })
    console.log(`  ✅ ${gatherings.length} gathering`)

    // ── VisitCompany ─────────────────────────────────────────────────
    const companies = await src.visitCompany.findMany()
    section('VisitCompany')
    await tgt.visitCompany.createMany({ data: companies, skipDuplicates: true })
    console.log(`  ✅ ${companies.length} visit company`)

    // ── SpotDemplot + Detail ──────────────────────────────────────────
    const spots = await src.spotDemplot.findMany({ include: { details: true } })
    section('SpotDemplot')
    await tgt.spotDemplot.createMany({
      data: spots.map(({ details, ...s }) => s),
      skipDuplicates: true
    })
    const spotDetails = spots.flatMap(s => s.details)
    if (spotDetails.length) await tgt.spotDemplotDetail.createMany({ data: spotDetails, skipDuplicates: true })
    console.log(`  ✅ ${spots.length} spot, ${spotDetails.length} detail`)

    // ── StockOpname + Detail ─────────────────────────────────────────
    const opnames = await src.stockOpname.findMany({ include: { details: true } })
    section('StockOpname')
    await tgt.stockOpname.createMany({
      data: opnames.map(({ details, ...o }) => o),
      skipDuplicates: true
    })
    const opDetails = opnames.flatMap(o => o.details)
    if (opDetails.length) await tgt.opnameDetail.createMany({ data: opDetails, skipDuplicates: true })
    console.log(`  ✅ ${opnames.length} opname, ${opDetails.length} detail`)

    // ── Notification ─────────────────────────────────────────────────
    const notifs = await src.notification.findMany()
    section('Notification')
    await tgt.notification.createMany({ data: notifs, skipDuplicates: true })
    console.log(`  ✅ ${notifs.length} notifikasi`)

    // ── SystemConfig ─────────────────────────────────────────────────
    const configs = await src.systemConfig.findMany()
    section('SystemConfig')
    await tgt.systemConfig.createMany({ data: configs, skipDuplicates: true })
    console.log(`  ✅ ${configs.length} system config`)

    console.log('\n\n🎉 MIGRASI SELESAI! Semua data berhasil dipindahkan.')
    console.log('   Sekarang update .env kembali ke database utama (ep-red-tooth) dan coba login.')

  } catch (err) {
    console.error('\n❌ Error:', err.message)
    console.error(err)
  } finally {
    await src.$disconnect()
    await tgt.$disconnect()
  }
}

migrate()
