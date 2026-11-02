import prisma from '@/lib/prisma'
import { formatLedgerQty, hasGramasi } from '@/lib/stock-units'

export interface DemoplotProductUsage {
  name: string
  actualUsage: number
  unit: string
  label: string // e.g. "Biogent 50 SC 1 L (90 ml)"
  /** Pemakaian dari stok sendiri (sampel), satuan ledger. Produk milik petani tidak dihitung. */
  sampleQty: number
  /** Satuan sampleQty: ml/gr untuk produk bergramasi, selain itu kemasan */
  sampleUnit: string
  /** sampleQty dalam liter/kg (÷1000); null bila produk tidak bergramasi */
  sampleLiterKg: number | null
  /** Kode barang Accurate (= item_no di faktur), huruf kecil; null bila belum terhubung */
  sku: string | null
}

export interface ProductImpactResult {
  product_name: string
  unit: string
  before_qty: number
  before_omset: number
  after_qty: number
  after_omset: number
  delta_qty: number
  delta_omset: number
  delta_pct: number
  is_new: boolean
  matched_skus: string[]
  sample_qty: number
  sample_unit: string
  sample_liter_kg: number | null
  /** PCS (kemasan dasar) SKU yang sama persis dengan produk demplot, 60 hari sesudah; null bila produk tanpa kode SKU */
  same_sku_after_pcs: number | null
  /** same_sku_after_pcs ÷ sampel (L/kg); null bila tidak bisa dihitung */
  pcs_per_liter_kg: number | null
  /** Volume terjual (L/kg) semua ukuran kemasan produk ini, 60 hari sesudah */
  sold_volume_liter_kg: number
  /** sold_volume_liter_kg ÷ sampel (L/kg); null bila tidak bisa dihitung */
  volume_per_liter_kg: number | null
}

export interface StoreImpactItem {
  product_name: string
  quantity: number
  omset: number
  unit: string
  is_new: boolean
}

export interface StoreImpactResult {
  customer_id: string
  customer_no?: string | null
  name: string
  city?: string | null
  region?: string | null
  default_salesman?: string | null
  latitude: number
  longitude: number
  distance_km: number
  has_impact: boolean
  impact_total_qty: number
  impact_total_omset: number
  impact_products: StoreImpactItem[]
  before_total_omset: number
  after_total_omset: number
}

/** Ringkasan dampak per demplot. Dipakai bersama oleh tabel, peta, dan kartu panel. */
export interface DemoImpactSummary {
  store_count: number            // semua toko ber-GPS di radius (penyebut)
  analyzed_store_count: number   // toko ber-accurate_id yang dianalisa (maks 80 terdekat)
  impacted_store_count: number   // toko dengan qty neto produk demplot sesudah > 0
  impact_pct: number | null      // 1 desimal; null bila store_count = 0
  impact_pct_capped: boolean     // true = angka adalah batas bawah
  before_qty: number
  after_qty: number
  before_omset: number
  after_omset: number
  /** Total sampel (L dan kg dijumlahkan, asumsi 1 L ≈ 1 kg); null bila tidak ada sampel ber-gramasi */
  sample_liter_kg: number | null
  /** PCS (kemasan dasar) SKU sama yang terjual 60 hari sesudah, dari produk bersampel yang punya kode SKU */
  sold_after_qty_sampled: number
  /** sold_after_qty_sampled ÷ sampel produk tersebut (L/kg), 1 desimal; null bila tidak bisa dihitung */
  pcs_per_liter_kg: number | null
  /** Volume terjual (L/kg, semua ukuran kemasan) 60 hari sesudah dari produk bersampel */
  sold_volume_liter_kg: number
  /** sold_volume_liter_kg ÷ sample_liter_kg (berapa kali lipat sampel), 1 desimal; null bila tidak bisa dihitung */
  volume_per_liter_kg: number | null
}

export interface DemoplotImpactDetail {
  demoplot: {
    id: string
    farmerName: string
    commodity: string
    date: string
    area: string
    location_label: string
    foName: string
    resultNotes?: string | null
    latitude: number
    longitude: number
    products: DemoplotProductUsage[]
  }
  window: {
    radius_km: number
    days: number
    before_start: string
    before_end: string
    after_start: string
    after_end: string
  }
  summary: {
    has_impact: boolean
    before_omset: number
    before_invoices_count: number
    after_omset: number
    after_invoices_count: number
    delta_omset: number
    delta_pct: number
    total_stores_in_radius: number
    impacted_stores_count: number
  }
  impact: DemoImpactSummary
  product_impacts: ProductImpactResult[]
  stores: StoreImpactResult[]
}

export interface DemoplotListItem {
  id: string
  farmerName: string
  commodity: string
  date: string
  area: string
  foName: string
  latitude: number
  longitude: number
  productCount: number
  products: string[]
  has_impact: boolean
  impact: DemoImpactSummary
}

export const WINDOW_DAYS = 60
export const MAX_STORES_PER_DEMO = 80

// -------------------------------------------------------------
// 1. Spasial: Rumus Haversine (Radius km)
// -------------------------------------------------------------
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// -------------------------------------------------------------
// 2. Pencocokan Produk Demplot dengan Item Invoice (Fuzzy Token)
// -------------------------------------------------------------
// Daftar sama persis dengan Sales Dashboard agar hasil pencocokan identik.
const UNIT_STOP = new Set([
  'ml', 'l', 'ltr', 'kg', 'gr', 'g', 'gram', 'cc', 'box', 'btl', 'btol', 'botol', 'pack', 'pak', 'sachet', 'saset',
  'ec', 'sl', 'wp', 'sc', 'wg', 'wdg', 'ws', 'as', 'fs', 'sp', 'od', 'se', 'dc', 'cs', 'ew', 'me', 'sg',
])

export function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function sigTokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length >= 3 && !UNIT_STOP.has(t) && !/^\d+$/.test(t))
}

export function productsMatch(demoplotProd: string, invoiceItemName: string): boolean {
  const na = norm(demoplotProd)
  const nb = norm(invoiceItemName)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true

  const ta = new Set(sigTokens(demoplotProd))
  const tb = new Set(sigTokens(invoiceItemName))
  if (ta.size === 0 || tb.size === 0) return false

  let overlap = 0
  let brandHit = false
  ta.forEach(t => {
    if (tb.has(t)) {
      overlap++
      if (t.length >= 5) brandHit = true // Kata brand utama
    }
  })
  return overlap >= 2 || brandHit
}

/**
 * Pencocok item invoice → indeks produk demplot PERTAMA yang cocok (urutan produk demplot),
 * atau -1. Hasil di-cache per nama item.
 */
function makeProductMatcher(products: string[]) {
  const cache = new Map<string, number>()
  return (itemName: string): number => {
    const hit = cache.get(itemName)
    if (hit !== undefined) return hit
    let idx = -1
    for (let i = 0; i < products.length; i++) {
      if (productsMatch(products[i], itemName)) { idx = i; break }
    }
    cache.set(itemName, idx)
    return idx
  }
}

// -------------------------------------------------------------
// 3. Bahan hitung: tanggal, toko, invoice
// -------------------------------------------------------------
const jakartaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah Date. */
export function toDateStr(d: Date): string {
  return jakartaDate.format(d)
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

interface StoreRef {
  id: string
  accurateId: string | null
  customerNo: string | null
  name: string
  city: string | null
  region: string | null
  defaultSalesman: string | null
  latitude: number
  longitude: number
}

interface InvItem { name: string; qty: number; omset: number; unit: string; itemNo: string }
interface ProcessedInv { id: string; date: string; omset: number; items: InvItem[] }

async function loadStores(): Promise<StoreRef[]> {
  const rows = await prisma.dashboardCustomer.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: {
      id: true, accurateId: true, customerNo: true, name: true, city: true, region: true,
      defaultSalesman: true, latitude: true, longitude: true,
    },
  })
  return rows.map(r => ({ ...r, latitude: r.latitude!, longitude: r.longitude! }))
}

/**
 * Item invoice dari Sales Dashboard sudah diratakan ({ item_name, quantity, unit, total_price }),
 * jadi qty dipakai apa adanya. Retur dikali -1.
 */
function processInvoice(inv: { id: string; tanggal: Date; status: string | null; omset: number; items: unknown }): ProcessedInv {
  const sign = (inv.status || '').toLowerCase().includes('retur') ? -1 : 1
  let raw: unknown = inv.items
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = [] }
  }
  const items: InvItem[] = []
  for (const it of Array.isArray(raw) ? (raw as any[]) : []) {
    const qty = Number(it?.quantity) || 0
    const omset = Number(it?.total_price) || qty * (Number(it?.unit_price) || 0)
    if (qty === 0 && omset === 0) continue
    items.push({
      name: String(it?.item_name || it?.item_no || 'Item Tidak Diketahui'),
      qty: qty * sign,
      omset: omset * sign,
      unit: String(it?.unit || 'PCS'),
      itemNo: String(it?.item_no || '').trim().toLowerCase(),
    })
  }
  return { id: inv.id, date: toDateStr(inv.tanggal), omset: (Number(inv.omset) || 0) * sign, items }
}

// -------------------------------------------------------------
// Tabel satuan per SKU (kode item faktur)
// -------------------------------------------------------------
/**
 * Faktur Sales Dashboard mencatat qty dalam satuan transaksi (Btl, Bks, Box/karton, Sak, ...),
 * tanpa rasio karton. Rasio diturunkan dari median harga satuan tiap unit per SKU:
 * unit termurah = kemasan dasar (rasio 1), unit lain = round(median harga unit ÷ median harga dasar).
 * Contoh: Abacel 100 ml Btl ≈ Rp26.400, Box ≈ Rp1.362.500 → 1 Box ≈ 52 Btl.
 * Isi per kemasan dasar (ml/gr) diambil dari master produk lewat Product.accurateId = item_no.
 */
interface SkuInfo { ratios: Map<string, number>; gramasiPerUnit: number | null }
const SKU_CACHE_TTL_MS = 10 * 60_000
let skuCache: { expires: number; value: Map<string, SkuInfo> } | null = null

async function loadSkuTable(): Promise<Map<string, SkuInfo>> {
  if (skuCache && skuCache.expires > Date.now()) return skuCache.value

  const [invoices, products] = await Promise.all([
    prisma.dashboardInvoice.findMany({ select: { items: true } }),
    prisma.product.findMany({
      where: { accurateId: { not: null } },
      select: { accurateId: true, unit: true, unitGramasi: true, gramasiPerUnit: true },
    }),
  ])

  const prices = new Map<string, Map<string, number[]>>()
  for (const inv of invoices) {
    let raw: unknown = inv.items
    if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { raw = [] } }
    for (const it of Array.isArray(raw) ? (raw as any[]) : []) {
      const no = String(it?.item_no || '').trim().toLowerCase()
      const unit = String(it?.unit || '').trim().toLowerCase()
      const price = Number(it?.unit_price)
      if (!no || !unit || !(price > 0)) continue
      const byUnit = prices.get(no) || new Map<string, number[]>()
      const list = byUnit.get(unit) || []
      list.push(price)
      byUnit.set(unit, list)
      prices.set(no, byUnit)
    }
  }

  const median = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const gramBySku = new Map<string, number>()
  for (const p of products) {
    if (hasGramasi(p)) gramBySku.set(String(p.accurateId).trim().toLowerCase(), p.gramasiPerUnit as number)
  }

  const table = new Map<string, SkuInfo>()
  for (const [no, byUnit] of prices) {
    const medians = Array.from(byUnit.entries()).map(([u, list]) => [u, median(list)] as const)
    const base = Math.min(...medians.map(([, m]) => m))
    const ratios = new Map<string, number>()
    for (const [u, m] of medians) ratios.set(u, Math.max(1, Math.round(m / base)))
    table.set(no, { ratios, gramasiPerUnit: gramBySku.get(no) ?? null })
  }
  // SKU di master yang belum pernah punya harga di faktur: tetap catat isi per kemasannya (rasio 1)
  for (const [no, g] of gramBySku) if (!table.has(no)) table.set(no, { ratios: new Map(), gramasiPerUnit: g })

  skuCache = { expires: Date.now() + SKU_CACHE_TTL_MS, value: table }
  return table
}

/** Qty faktur → kemasan dasar (mis. 2 Box → 100 Btl). Unit tanpa data harga dianggap kemasan dasar. */
function toBasePcs(sku: Map<string, SkuInfo>, it: InvItem): number {
  const ratio = sku.get(it.itemNo)?.ratios.get(it.unit.trim().toLowerCase()) ?? 1
  return it.qty * ratio
}

/** Invoice toko-toko terpilih dalam rentang tanggal WIB [fromStr, toStr], dikelompokkan per id toko. */
async function loadInvoicesByStore(storeIds: string[], fromStr: string, toStr: string) {
  const byStore = new Map<string, ProcessedInv[]>()
  if (storeIds.length === 0) return byStore
  // Batas UTC dilebarkan 1 hari, lalu disaring ulang memakai tanggal WIB.
  const rows = await prisma.dashboardInvoice.findMany({
    where: {
      customerId: { in: storeIds },
      tanggal: { gte: new Date(`${addDays(fromStr, -1)}T00:00:00.000Z`), lte: new Date(`${addDays(toStr, 1)}T23:59:59.999Z`) },
    },
    select: { id: true, customerId: true, tanggal: true, status: true, omset: true, items: true },
  })
  for (const row of rows) {
    const inv = processInvoice(row)
    if (inv.date < fromStr || inv.date > toStr) continue
    const list = byStore.get(row.customerId!) || []
    list.push(inv)
    byStore.set(row.customerId!, list)
  }
  return byStore
}

/** Toko dalam radius (inklusif), urut terdekat. */
function storesWithin(stores: StoreRef[], lat: number, lng: number, radiusKm: number) {
  const out: Array<{ store: StoreRef; distance: number }> = []
  for (const store of stores) {
    const distance = haversineKm(lat, lng, store.latitude, store.longitude)
    if (distance <= radiusKm) out.push({ store, distance })
  }
  return out.sort((a, b) => a.distance - b.distance)
}

/**
 * Toko yang invoice-nya dianalisa: hanya yang punya accurate_id, maks 80 terdekat.
 * Invoice ditautkan ke toko lewat dashboard_invoices.customer_id (id toko Sales Dashboard,
 * dicocokkan dari nama toko saat sinkronisasi) karena Open API invoice tidak mengirim customer_id Accurate.
 */
function selectAnalyzed(inRadius: Array<{ store: StoreRef; distance: number }>) {
  const withAccurate = inRadius.filter(s => s.store.accurateId)
  return { analyzed: withAccurate.slice(0, MAX_STORES_PER_DEMO), capped: withAccurate.length > MAX_STORES_PER_DEMO }
}

// -------------------------------------------------------------
// 4. Perhitungan inti (satu fungsi untuk ringkasan & detail)
// -------------------------------------------------------------
interface ComputeInput {
  date: string | null           // YYYY-MM-DD (WIB)
  latitude: number
  longitude: number
  products: string[]            // urutan menentukan atribusi item
  sampleLiterKg?: Array<number | null> // sejajar dengan products
  skus?: Array<string | null>          // kode SKU produk demplot, sejajar dengan products
}

interface StoreCalc {
  beforeByProduct: number[]
  afterByProduct: number[]
  afterOmsetByProduct: number[]
  beforeOmsetByProduct: number[]
  before: ProcessedInv[]
  after: ProcessedInv[]
}

interface ComputeResult {
  summary: DemoImpactSummary
  has_impact: boolean
  inRadius: Array<{ store: StoreRef; distance: number }>
  perStore: Map<string, StoreCalc>
  productTotals: { beforeQty: number[]; afterQty: number[]; beforeOmset: number[]; afterOmset: number[] }
  /** PCS kemasan dasar SKU sama (sesudah) dan volume terjual L/kg (sesudah), per produk */
  yieldTotals: { sameSkuPcs: number[]; volumeLiterKg: number[] }
  matcher: (itemName: string) => number
  window: { from: string; to: string } | null
}

/** Rasio terhadap sampel (1 desimal). Terjual neto bisa negatif karena retur → dibatasi 0. */
function perSample(sold: number, sampleLiterKg: number | null | undefined): number | null {
  if (!sampleLiterKg || sampleLiterKg <= 0) return null
  return Math.round((Math.max(0, sold) / sampleLiterKg) * 10) / 10
}

function computeDemoImpact(
  demo: ComputeInput,
  stores: StoreRef[],
  invoicesByStore: Map<string, ProcessedInv[]>,
  radiusKm: number,
  sku: Map<string, SkuInfo> = new Map()
): ComputeResult {
  const inRadius = storesWithin(stores, demo.latitude, demo.longitude, radiusKm)
  const { analyzed, capped } = selectAnalyzed(inRadius)
  const n = demo.products.length
  const zeros = () => new Array<number>(n).fill(0)
  const productTotals = { beforeQty: zeros(), afterQty: zeros(), beforeOmset: zeros(), afterOmset: zeros() }
  const yieldTotals = { sameSkuPcs: zeros(), volumeLiterKg: zeros() }
  // SKU produk demplot → indeks (untuk PCS SKU sama, tidak bergantung pencocokan nama)
  const skuIndex = new Map<string, number>()
  demo.skus?.forEach((code, i) => { if (code && !skuIndex.has(code)) skuIndex.set(code, i) })
  const perStore = new Map<string, StoreCalc>()
  const matcher = makeProductMatcher(demo.products)
  let impacted = 0

  const window = demo.date ? { from: addDays(demo.date, -WINDOW_DAYS), to: addDays(demo.date, WINDOW_DAYS) } : null

  if (window && n > 0) {
    for (const { store } of analyzed) {
      const calc: StoreCalc = {
        beforeByProduct: zeros(), afterByProduct: zeros(), beforeOmsetByProduct: zeros(), afterOmsetByProduct: zeros(),
        before: [], after: [],
      }
      for (const inv of invoicesByStore.get(store.id) || []) {
        if (inv.date < window.from || inv.date > window.to) continue
        const isAfter = inv.date >= demo.date!
        ;(isAfter ? calc.after : calc.before).push(inv)
        for (const it of inv.items) {
          if (isAfter) {
            const skuIdx = it.itemNo ? skuIndex.get(it.itemNo) : undefined
            if (skuIdx !== undefined) yieldTotals.sameSkuPcs[skuIdx] += toBasePcs(sku, it)
          }
          const idx = matcher(it.name)
          if (idx < 0) continue
          if (isAfter) {
            calc.afterByProduct[idx] += it.qty
            calc.afterOmsetByProduct[idx] += it.omset
            const g = sku.get(it.itemNo)?.gramasiPerUnit
            if (g) yieldTotals.volumeLiterKg[idx] += (toBasePcs(sku, it) * g) / 1000
          } else {
            calc.beforeByProduct[idx] += it.qty
            calc.beforeOmsetByProduct[idx] += it.omset
          }
        }
      }
      for (let i = 0; i < n; i++) {
        productTotals.beforeQty[i] += calc.beforeByProduct[i]
        productTotals.afterQty[i] += calc.afterByProduct[i]
        productTotals.beforeOmset[i] += calc.beforeOmsetByProduct[i]
        productTotals.afterOmset[i] += calc.afterOmsetByProduct[i]
      }
      if (calc.afterByProduct.some(q => q > 0)) impacted++
      perStore.set(store.id, calc)
    }
  }

  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  const storeCount = inRadius.length
  const summary: DemoImpactSummary = {
    store_count: storeCount,
    analyzed_store_count: analyzed.length,
    impacted_store_count: impacted,
    impact_pct: storeCount > 0 ? Math.round((impacted / storeCount) * 1000) / 10 : null,
    impact_pct_capped: capped,
    before_qty: sum(productTotals.beforeQty),
    after_qty: sum(productTotals.afterQty),
    before_omset: sum(productTotals.beforeOmset),
    after_omset: sum(productTotals.afterOmset),
    sample_liter_kg: null,
    sold_after_qty_sampled: 0,
    pcs_per_liter_kg: null,
    sold_volume_liter_kg: 0,
    volume_per_liter_kg: null,
  }
  // Rasio sampel → penjualan (hanya produk bersampel L/kg).
  //  - PCS SKU sama: hanya produk yang punya kode SKU; penyebutnya sampel produk-produk itu saja.
  //  - Volume: semua ukuran kemasan produk yang cocok, dikonversi ke L/kg.
  let sampleTotal = 0
  let sampleWithSku = 0
  let pcsSameSku = 0
  let volume = 0
  demo.sampleLiterKg?.forEach((lk, i) => {
    if (!lk || lk <= 0) return
    sampleTotal += lk
    volume += yieldTotals.volumeLiterKg[i]
    if (demo.skus?.[i]) {
      sampleWithSku += lk
      pcsSameSku += yieldTotals.sameSkuPcs[i]
    }
  })
  const measurable = analyzed.length > 0 // tanpa toko yang dianalisa, penjualan tidak bisa diukur → "-"
  summary.sample_liter_kg = sampleTotal > 0 ? Math.round(sampleTotal * 1000) / 1000 : null
  summary.sold_after_qty_sampled = Math.round(pcsSameSku * 100) / 100
  summary.pcs_per_liter_kg = measurable ? perSample(pcsSameSku, sampleWithSku) : null
  summary.sold_volume_liter_kg = Math.round(volume * 1000) / 1000
  summary.volume_per_liter_kg = measurable ? perSample(volume, sampleTotal) : null

  // Flag "Terdampak" (⭐): ada produk yang total qty sesudah > sebelum dan sesudah > 0.
  const hasImpact = productTotals.afterQty.some((q, i) => q > 0 && q > productTotals.beforeQty[i])

  return { summary, has_impact: hasImpact, inRadius, perStore, productTotals, yieldTotals, matcher, window }
}

// -------------------------------------------------------------
// 5. Pengelompokan demplot per request + daftar produk
// -------------------------------------------------------------
const demoGroupInclude = {
  farmer: { select: { name: true, address: true } },
  request: {
    select: {
      id: true,
      commodity: true,
      fo: { select: { name: true } },
      details: { select: { qtyApproved: true, qtyRequested: true, requestUnit: true, product: { select: { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true, accurateId: true } } } },
    },
  },
} as const

/**
 * Produk demplot satu request = gabungan detail semua sesinya (urutan sesi dibuat, lalu urutan detail),
 * fallback ke detail request bila sesi belum merekam produk.
 */
async function loadProductsByGroup(groups: Array<{ id: string; requestId: string | null; requestDetails?: any[] }>) {
  const requestIds = Array.from(new Set(groups.map(g => g.requestId).filter(Boolean))) as string[]
  const soloIds = groups.filter(g => !g.requestId).map(g => g.id)

  const sessions = await prisma.demoPlot.findMany({
    where: { OR: [{ requestId: { in: requestIds } }, { id: { in: soloIds } }] },
    select: {
      id: true,
      requestId: true,
      details: { select: { actualUsage: true, usedFarmerProduct: true, product: { select: { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true, accurateId: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const byKey = new Map<string, Map<string, DemoplotProductUsage>>()
  for (const s of sessions) {
    const key = s.requestId ? `req_${s.requestId}` : `dp_${s.id}`
    const map = byKey.get(key) || new Map<string, DemoplotProductUsage>()
    for (const d of s.details) {
      const pName = d.product?.name
      if (!pName) continue
      // `unit` tetap satuan kemasan (dipakai untuk qty faktur di product_impacts).
      // actualUsage tercatat dalam satuan ledger (ml/gr bila produk bergramasi), jadi label memakai formatLedgerQty.
      const unit = d.product?.unit || 'PCS'
      const usage = Number(d.actualUsage) || 0
      // Sampel = pemakaian dari stok sendiri; produk milik petani bukan sampel
      const sampleUsage = d.usedFarmerProduct ? 0 : usage
      const gram = hasGramasi(d.product)
      const existing = map.get(pName)
      if (existing) {
        existing.actualUsage += usage
        existing.sampleQty += sampleUsage
        existing.sampleLiterKg = gram ? existing.sampleQty / 1000 : null
        existing.label = `${pName} (${formatLedgerQty(d.product, existing.actualUsage, { showKemasan: false })})`
      } else {
        map.set(pName, {
          name: pName, actualUsage: usage, unit,
          label: `${pName} (${formatLedgerQty(d.product, usage, { showKemasan: false })})`,
          sampleQty: sampleUsage,
          sampleUnit: gram ? (d.product.unitGramasi as string) : unit,
          sampleLiterKg: gram ? sampleUsage / 1000 : null,
          sku: d.product?.accurateId ? d.product.accurateId.trim().toLowerCase() : null,
        })
      }
    }
    byKey.set(key, map)
  }

  const result = new Map<string, DemoplotProductUsage[]>()
  for (const g of groups) {
    const key = g.requestId ? `req_${g.requestId}` : `dp_${g.id}`
    let list = Array.from((byKey.get(key) || new Map()).values())
    if (list.length === 0 && g.requestDetails) {
      list = []
      for (const rd of g.requestDetails) {
        const pName = rd.product?.name
        if (!pName || list.some(p => p.name === pName)) continue
        const qty = Number(rd.qtyApproved ?? rd.qtyRequested) || 0
        const unit = rd.product?.unit || 'PCS'
        // qtyApproved pengajuan FO sudah dalam satuan ledger; qtyRequested dalam requestUnit
        const label = rd.qtyApproved != null || !rd.requestUnit
          ? formatLedgerQty(rd.product, qty, { showKemasan: false })
          : `${qty.toLocaleString('id-ID')} ${rd.requestUnit}`
        // Detail request (jalur cadangan) dalam satuan ledger bila sudah disetujui → dipakai sebagai sampel
        const gram = hasGramasi(rd.product) && (rd.qtyApproved != null || !rd.requestUnit)
        list.push({
          name: pName, actualUsage: qty, unit, label: `${pName} (${label})`,
          sampleQty: qty,
          sampleUnit: gram ? (rd.product.unitGramasi as string) : (rd.requestUnit || unit),
          sampleLiterKg: gram ? qty / 1000 : null,
          sku: rd.product?.accurateId ? String(rd.product.accurateId).trim().toLowerCase() : null,
        })
      }
    }
    result.set(g.id, list)
  }
  return result
}

// -------------------------------------------------------------
// 6. Detail Analisis Dampak Kegiatan Demo Plot (panel)
// -------------------------------------------------------------
export async function calculateDemoplotImpact(activityId: string, radiusKm: number): Promise<DemoplotImpactDetail | null> {
  const dp = await prisma.demoPlot.findUnique({ where: { id: activityId }, include: demoGroupInclude })
  if (!dp || dp.latitude === null || dp.longitude === null) return null

  const productsMap = await loadProductsByGroup([{ id: dp.id, requestId: dp.requestId, requestDetails: dp.request?.details }])
  const demoplotProducts = productsMap.get(dp.id) || []
  const date = toDateStr(dp.date)

  const [stores, skuTable] = await Promise.all([loadStores(), loadSkuTable()])
  const inRadius = storesWithin(stores, dp.latitude, dp.longitude, radiusKm)
  const { analyzed } = selectAnalyzed(inRadius)
  const invoicesByStore = await loadInvoicesByStore(
    analyzed.map(a => a.store.id), addDays(date, -WINDOW_DAYS), addDays(date, WINDOW_DAYS)
  )

  const calc = computeDemoImpact(
    {
      date, latitude: dp.latitude, longitude: dp.longitude,
      products: demoplotProducts.map(p => p.name),
      sampleLiterKg: demoplotProducts.map(p => p.sampleLiterKg),
      skus: demoplotProducts.map(p => p.sku),
    },
    stores, invoicesByStore, radiusKm, skuTable
  )

  // Per produk
  const productImpacts: ProductImpactResult[] = demoplotProducts.map((p, i) => {
    const beforeQty = calc.productTotals.beforeQty[i]
    const afterQty = calc.productTotals.afterQty[i]
    const beforeOmset = calc.productTotals.beforeOmset[i]
    const afterOmset = calc.productTotals.afterOmset[i]
    const deltaOmset = afterOmset - beforeOmset
    const matched = new Set<string>()
    for (const sc of calc.perStore.values()) {
      for (const inv of [...sc.before, ...sc.after]) {
        for (const it of inv.items) if (calc.matcher(it.name) === i) matched.add(it.name)
      }
    }
    return {
      product_name: p.name,
      unit: p.unit,
      before_qty: Math.max(0, beforeQty),
      before_omset: Math.max(0, beforeOmset),
      after_qty: Math.max(0, afterQty),
      after_omset: Math.max(0, afterOmset),
      delta_qty: afterQty - beforeQty,
      delta_omset: deltaOmset,
      delta_pct: beforeOmset > 0 ? Math.round((deltaOmset / beforeOmset) * 100) : (afterOmset > 0 ? 100 : 0),
      is_new: beforeQty <= 0 && afterQty > 0,
      matched_skus: Array.from(matched),
      sample_qty: p.sampleQty,
      sample_unit: p.sampleUnit,
      sample_liter_kg: p.sampleLiterKg,
      same_sku_after_pcs: p.sku ? Math.round(calc.yieldTotals.sameSkuPcs[i] * 100) / 100 : null,
      pcs_per_liter_kg: p.sku && calc.summary.analyzed_store_count > 0 ? perSample(calc.yieldTotals.sameSkuPcs[i], p.sampleLiterKg) : null,
      sold_volume_liter_kg: Math.round(calc.yieldTotals.volumeLiterKg[i] * 1000) / 1000,
      volume_per_liter_kg: calc.summary.analyzed_store_count > 0 ? perSample(calc.yieldTotals.volumeLiterKg[i], p.sampleLiterKg) : null,
    }
  })

  // Per toko (semua toko di radius; toko di luar yang dianalisa tidak punya data invoice)
  const storeResults: StoreImpactResult[] = calc.inRadius.map(({ store, distance }) => {
    const sc = calc.perStore.get(store.id)
    const impactMap = new Map<string, StoreImpactItem>()
    let impactQty = 0
    let impactOmset = 0
    if (sc) {
      for (const inv of sc.after) {
        for (const it of inv.items) {
          const idx = calc.matcher(it.name)
          if (idx < 0) continue
          const cur = impactMap.get(it.name) || {
            product_name: it.name, quantity: 0, omset: 0, unit: it.unit, is_new: sc.beforeByProduct[idx] <= 0,
          }
          cur.quantity += it.qty
          cur.omset += it.omset
          impactMap.set(it.name, cur)
          impactQty += it.qty
          impactOmset += it.omset
        }
      }
    }
    return {
      customer_id: store.id,
      customer_no: store.customerNo,
      name: store.name,
      city: store.city,
      region: store.region,
      default_salesman: store.defaultSalesman,
      latitude: store.latitude,
      longitude: store.longitude,
      distance_km: Math.round(distance * 100) / 100,
      // Sama dengan aturan impacted_store_count: ada produk demplot dengan qty neto sesudah > 0.
      has_impact: !!sc && sc.afterByProduct.some(q => q > 0),
      impact_total_qty: impactQty,
      impact_total_omset: impactOmset,
      impact_products: Array.from(impactMap.values()).filter(p => p.quantity !== 0 || p.omset !== 0),
      before_total_omset: Math.max(0, sc ? sc.before.reduce((s, inv) => s + inv.omset, 0) : 0),
      after_total_omset: Math.max(0, sc ? sc.after.reduce((s, inv) => s + inv.omset, 0) : 0),
    }
  })
  storeResults.sort((a, b) => (a.has_impact !== b.has_impact ? (a.has_impact ? -1 : 1) : a.distance_km - b.distance_km))

  // Jumlah invoice yang memuat produk demplot
  let beforeInvoicesCount = 0
  let afterInvoicesCount = 0
  for (const sc of calc.perStore.values()) {
    beforeInvoicesCount += sc.before.filter(inv => inv.items.some(it => calc.matcher(it.name) >= 0)).length
    afterInvoicesCount += sc.after.filter(inv => inv.items.some(it => calc.matcher(it.name) >= 0)).length
  }

  const { before_omset, after_omset } = calc.summary
  const deltaOmset = after_omset - before_omset
  const locationLabel = [dp.area, dp.farmer?.address].filter(Boolean).join(', ') || 'Lokasi Demplot'

  return {
    demoplot: {
      id: dp.id,
      farmerName: dp.farmer?.name || 'Petani',
      commodity: dp.commodity || dp.request?.commodity || 'Padi',
      date,
      area: dp.area || '-',
      location_label: locationLabel,
      foName: dp.request?.fo?.name || '-',
      resultNotes: dp.resultNotes || null,
      latitude: dp.latitude,
      longitude: dp.longitude,
      products: demoplotProducts,
    },
    window: {
      radius_km: radiusKm,
      days: WINDOW_DAYS,
      before_start: addDays(date, -WINDOW_DAYS),
      before_end: addDays(date, -1),
      after_start: date,
      after_end: addDays(date, WINDOW_DAYS),
    },
    summary: {
      has_impact: calc.has_impact,
      before_omset,
      before_invoices_count: beforeInvoicesCount,
      after_omset,
      after_invoices_count: afterInvoicesCount,
      delta_omset: deltaOmset,
      delta_pct: before_omset > 0 ? Math.round((deltaOmset / before_omset) * 100) : (after_omset > 0 ? 100 : 0),
      total_stores_in_radius: calc.summary.store_count,
      impacted_stores_count: calc.summary.impacted_store_count,
    },
    impact: calc.summary,
    product_impacts: productImpacts,
    stores: storeResults,
  }
}

// -------------------------------------------------------------
// 7. Daftar Demplot + Ringkasan Dampak (peta & tabel)
// -------------------------------------------------------------
const SUMMARY_CACHE_TTL_MS = 60_000
const summaryCache = new Map<string, { expires: number; value: DemoplotListItem[] }>()

export function clearImpactSummaryCache() {
  summaryCache.clear()
}

export async function getDemoplotsWithImpactSummary(fromDate: string | undefined, toDate: string | undefined, radiusKm: number) {
  const cacheKey = `${fromDate || ''}|${toDate || ''}|${radiusKm}`
  const cached = summaryCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.value

  const whereClause: any = { latitude: { not: null }, longitude: { not: null } }
  if (fromDate || toDate) {
    whereClause.date = {}
    if (fromDate) whereClause.date.gte = new Date(`${fromDate}T00:00:00.000Z`)
    if (toDate) whereClause.date.lte = new Date(`${toDate}T23:59:59.999Z`)
  }

  const demoPlots = await prisma.demoPlot.findMany({
    where: whereClause,
    include: demoGroupInclude,
    orderBy: { createdAt: 'desc' },
  })

  // Satu titik per request: sesi terbaru
  const groupMap = new Map<string, (typeof demoPlots)[0]>()
  for (const dp of demoPlots) {
    const key = dp.requestId ? `req_${dp.requestId}` : `dp_${dp.id}`
    if (!groupMap.has(key)) groupMap.set(key, dp)
  }
  const groups = Array.from(groupMap.values())

  const productsByGroup = await loadProductsByGroup(
    groups.map(g => ({ id: g.id, requestId: g.requestId, requestDetails: g.request?.details }))
  )

  // Muat toko sekali, lalu invoice sekali untuk semua toko yang dianalisa di demplot mana pun
  const [stores, skuTable] = await Promise.all([loadStores(), loadSkuTable()])
  const analyzedIds = new Set<string>()
  let minDate: string | null = null
  let maxDate: string | null = null
  for (const g of groups) {
    const d = toDateStr(g.date)
    if (!minDate || d < minDate) minDate = d
    if (!maxDate || d > maxDate) maxDate = d
    const { analyzed } = selectAnalyzed(storesWithin(stores, g.latitude!, g.longitude!, radiusKm))
    for (const a of analyzed) analyzedIds.add(a.store.id)
  }
  const invoicesByStore = minDate && maxDate
    ? await loadInvoicesByStore(Array.from(analyzedIds), addDays(minDate, -WINDOW_DAYS), addDays(maxDate, WINDOW_DAYS))
    : new Map<string, ProcessedInv[]>()

  const results: DemoplotListItem[] = groups.map(dp => {
    const productUsages = productsByGroup.get(dp.id) || []
    const products = productUsages.map(p => p.name)
    const calc = computeDemoImpact(
      {
        date: toDateStr(dp.date), latitude: dp.latitude!, longitude: dp.longitude!, products,
        sampleLiterKg: productUsages.map(p => p.sampleLiterKg),
        skus: productUsages.map(p => p.sku),
      },
      stores, invoicesByStore, radiusKm, skuTable
    )
    return {
      id: dp.id,
      farmerName: dp.farmer?.name || 'Petani',
      commodity: dp.commodity || dp.request?.commodity || 'Padi',
      date: toDateStr(dp.date),
      area: dp.area || '-',
      foName: dp.request?.fo?.name || '-',
      latitude: dp.latitude!,
      longitude: dp.longitude!,
      productCount: products.length,
      products,
      has_impact: calc.has_impact,
      impact: calc.summary,
    }
  })

  summaryCache.set(cacheKey, { expires: Date.now() + SUMMARY_CACHE_TTL_MS, value: results })
  return results
}

// -------------------------------------------------------------
// 8. Riwayat Transaksi Toko 12 Bulan Terakhir (Modal)
// -------------------------------------------------------------
export async function getStore12MonthInvoices(customerId?: string, storeName?: string) {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const whereConditions: any[] = []
  if (customerId) whereConditions.push({ customerId })
  if (storeName) whereConditions.push({ namaToko: { equals: storeName, mode: 'insensitive' } })

  if (whereConditions.length === 0) return []

  const invoices = await prisma.dashboardInvoice.findMany({
    where: {
      tanggal: { gte: oneYearAgo },
      OR: whereConditions,
    },
    orderBy: { tanggal: 'desc' }
  })

  return invoices.map(inv => ({
    id_invoice: inv.id,
    tanggal: inv.tanggal.toISOString().slice(0, 10),
    status: inv.status || 'Terkirim',
    omset: Number(inv.omset) || 0,
    items: (Array.isArray(inv.items) ? inv.items : []) as any[],
  }))
}

// -------------------------------------------------------------
// 9. Produk Paling Sering Dipakai di Kegiatan Demo Plot & Lapangan
// -------------------------------------------------------------
export async function getTopDemoplotProducts(
  limit = 10,
  fromDate?: string,
  toDate?: string,
  activityType: 'demoplot' | 'spot-demplot' | 'all' = 'demoplot'
) {
  const countMap = new Map<string, { name: string; count: number }>()

  // 1. Ambil data dari DemoPlotDetail (Khusus Demplot atau Semua)
  if (activityType === 'demoplot' || activityType === 'all') {
    const whereClause: any = {}
    if (fromDate || toDate) {
      whereClause.demoPlot = {
        date: {}
      }
      if (fromDate) whereClause.demoPlot.date.gte = new Date(`${fromDate}T00:00:00.000Z`)
      if (toDate) whereClause.demoPlot.date.lte = new Date(`${toDate}T23:59:59.999Z`)
    }

    const usages = await prisma.demoPlotDetail.findMany({
      where: whereClause,
      select: {
        productId: true,
        product: { select: { name: true, unit: true } }
      }
    })

    for (const u of usages) {
      const name = u.product?.name
      if (!name) continue
      const existing = countMap.get(name)
      if (existing) {
        existing.count++
      } else {
        countMap.set(name, { name, count: 1 })
      }
    }
  }

  // 2. Ambil data dari SpotDemplotDetail (Spot Demplot atau Semua)
  if (activityType === 'spot-demplot' || activityType === 'all') {
    const spotWhere: any = {}
    if (fromDate || toDate) {
      spotWhere.spotDemplot = {
        date: {}
      }
      if (fromDate) spotWhere.spotDemplot.date.gte = new Date(`${fromDate}T00:00:00.000Z`)
      if (toDate) spotWhere.spotDemplot.date.lte = new Date(`${toDate}T23:59:59.999Z`)
    }

    const spotUsages = await prisma.spotDemplotDetail.findMany({
      where: spotWhere,
      select: {
        productId: true,
        product: { select: { name: true, unit: true } }
      }
    })

    for (const u of spotUsages) {
      const name = u.product?.name
      if (!name) continue
      const existing = countMap.get(name)
      if (existing) {
        existing.count++
      } else {
        countMap.set(name, { name, count: 1 })
      }
    }
  }

  const sorted = Array.from(countMap.values()).sort((a, b) => b.count - a.count)
  return sorted.slice(0, limit)
}
