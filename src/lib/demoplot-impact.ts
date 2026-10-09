import prisma from '@/lib/prisma'

export interface DemoplotProductUsage {
  name: string
  actualUsage: number
  unit: string
  label: string // e.g. "Biogent 50 SC 1 L (90 PCS)"
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
  product_impacts: ProductImpactResult[]
  stores: StoreImpactResult[]
}

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
const UNIT_STOP = new Set([
  'ml', 'l', 'ltr', 'kg', 'gr', 'g', 'gram', 'cc', 'box', 'btl', 'botol', 'pack', 'sachet',
  'ec', 'sl', 'wp', 'sc', 'wg', 'wdg', 'ws', 'as', 'fs', 'sp', 'od', 'se', 'dc', 'cs', 'ew'
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

// -------------------------------------------------------------
// 3. Detail Analisis Dampak Kegiatan Demo Plot
// -------------------------------------------------------------
export async function calculateDemoplotImpact(
  activityId: string,
  radiusKm: number = 5,
  windowDays: number = 60
): Promise<DemoplotImpactDetail | null> {
  // 3.1. Ambil data DemoPlot terpilih
  const dp = await prisma.demoPlot.findUnique({
    where: { id: activityId },
    include: {
      farmer: true,
      request: {
        include: {
          fo: { select: { name: true, area: { select: { name: true } } } },
          details: { include: { product: true } }
        }
      },
      details: { include: { product: true } }
    }
  })

  if (!dp || dp.latitude === null || dp.longitude === null) {
    return null
  }

  // Jika memiliki requestId, ambil akumulasi seluruh produk dari semua sesi demoplot ini
  let siblingSessions = [dp]
  if (dp.requestId) {
    siblingSessions = await prisma.demoPlot.findMany({
      where: { requestId: dp.requestId },
      include: {
        details: { include: { product: true } },
      },
      orderBy: { createdAt: 'asc' }
    }) as any
  }

  // Kumpulkan produk yang didemoplotkan (nama, kuantiti, kemasan)
  const productMap = new Map<string, DemoplotProductUsage>()
  for (const s of siblingSessions) {
    for (const d of (s.details || [])) {
      const pName = d.product?.name
      if (!pName) continue
      const existing = productMap.get(pName)
      const unit = d.product?.unit || 'PCS'
      const usage = Number(d.actualUsage) || 0
      if (existing) {
        existing.actualUsage += usage
        existing.label = `${pName} (${existing.actualUsage} ${unit})`
      } else {
        productMap.set(pName, {
          name: pName,
          actualUsage: usage,
          unit,
          label: `${pName} (${usage} ${unit})`,
        })
      }
    }
  }

  // Fallback ke request details jika sesi belum merekam detail
  if (productMap.size === 0 && dp.request?.details) {
    for (const rd of dp.request.details) {
      const pName = rd.product?.name
      if (!pName) continue
      const qty = Number(rd.qtyApproved ?? rd.qtyRequested) || 0
      const unit = rd.product?.unit || rd.requestUnit || 'PCS'
      productMap.set(pName, {
        name: pName,
        actualUsage: qty,
        unit,
        label: `${pName} (${qty} ${unit})`,
      })
    }
  }

  const demoplotProducts = Array.from(productMap.values())

  // 3.2. Hitung jendela waktu Sebelum vs Sesudah
  const demoplotDate = new Date(dp.date)
  const beforeStart = new Date(demoplotDate.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const beforeEnd = new Date(demoplotDate.getTime() - 24 * 60 * 60 * 1000)
  const afterStart = new Date(demoplotDate)
  const afterEnd = new Date(demoplotDate.getTime() + windowDays * 24 * 60 * 60 * 1000)

  // 3.3. Ambil seluruh toko berkoordinat dari dashboard_customers dan hitung jarak
  const allStores = await prisma.dashboardCustomer.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    }
  })

  const storesInRadius: Array<{
    store: typeof allStores[0]
    distance: number
  }> = []

  for (const st of allStores) {
    if (st.latitude === null || st.longitude === null) continue
    const dist = haversineKm(dp.latitude, dp.longitude, st.latitude, st.longitude)
    if (dist <= radiusKm) {
      storesInRadius.push({
        store: st,
        distance: Math.round(dist * 100) / 100,
      })
    }
  }

  // Map toko untuk lookup cepat
  const storeIdSet = new Set(storesInRadius.map(s => s.store.id))
  const storeNameMap = new Map<string, typeof storesInRadius[0]>()
  for (const item of storesInRadius) {
    storeNameMap.set(norm(item.store.name), item)
  }

  // 3.4. Tarik faktur penjualan toko-toko dalam radius pada rentang waktu [beforeStart, afterEnd]
  const relevantInvoices = await prisma.dashboardInvoice.findMany({
    where: {
      tanggal: {
        gte: beforeStart,
        lte: afterEnd,
      },
      OR: [
        { customerId: { in: Array.from(storeIdSet) } },
        { namaToko: { in: storesInRadius.map(s => s.store.name) } }
      ]
    },
    orderBy: { tanggal: 'asc' }
  })

  // Pisahkan faktur per toko & periode (Before vs After)
  type InvItem = { item_name: string; quantity: number; total_price?: number; unit?: string }
  type ProcessedInv = { id: string; tanggal: Date; status: string; omset: number; items: InvItem[] }

  const storeInvoicesBefore = new Map<string, ProcessedInv[]>()
  const storeInvoicesAfter = new Map<string, ProcessedInv[]>()

  let totalBeforeOmset = 0
  let totalAfterOmset = 0
  let beforeInvoicesCount = 0
  let afterInvoicesCount = 0

  for (const inv of relevantInvoices) {
    const rawItems = Array.isArray(inv.items) ? (inv.items as any[]) : []
    const isRetur = (inv.status || '').toLowerCase().includes('retur')
    const multiplier = isRetur ? -1 : 1

    const processedInv: ProcessedInv = {
      id: inv.id,
      tanggal: new Date(inv.tanggal),
      status: inv.status || '',
      omset: (Number(inv.omset) || 0) * multiplier,
      items: rawItems.map(it => ({
        item_name: String(it.item_name || it.item_no || ''),
        quantity: (Number(it.quantity) || 0) * multiplier,
        total_price: (Number(it.total_price) || (Number(it.quantity) * Number(it.unit_price)) || 0) * multiplier,
        unit: String(it.unit || 'PCS'),
      }))
    }

    // Identifikasi store id target
    let targetStoreId = inv.customerId
    if (!targetStoreId || !storeIdSet.has(targetStoreId)) {
      const match = storeNameMap.get(norm(inv.namaToko || ''))
      if (match) targetStoreId = match.store.id
    }

    if (!targetStoreId) continue

    const invTime = processedInv.tanggal.getTime()
    if (invTime >= beforeStart.getTime() && invTime <= beforeEnd.getTime()) {
      if (!storeInvoicesBefore.has(targetStoreId)) storeInvoicesBefore.set(targetStoreId, [])
      storeInvoicesBefore.get(targetStoreId)!.push(processedInv)
    } else if (invTime >= afterStart.getTime() && invTime <= afterEnd.getTime()) {
      if (!storeInvoicesAfter.has(targetStoreId)) storeInvoicesAfter.set(targetStoreId, [])
      storeInvoicesAfter.get(targetStoreId)!.push(processedInv)
    }
  }

  // 3.5. Analisis Per-Produk Demplot
  const productImpacts: ProductImpactResult[] = []

  for (const p of demoplotProducts) {
    let beforeQty = 0
    let beforeOmset = 0
    let afterQty = 0
    let afterOmset = 0
    const matchedSkusSet = new Set<string>()

    // Akumulasi Before
    for (const [, invList] of storeInvoicesBefore) {
      for (const inv of invList) {
        for (const it of inv.items) {
          if (productsMatch(p.name, it.item_name)) {
            beforeQty += it.quantity
            beforeOmset += it.total_price || 0
            matchedSkusSet.add(it.item_name)
          }
        }
      }
    }

    // Akumulasi After
    for (const [, invList] of storeInvoicesAfter) {
      for (const inv of invList) {
        for (const it of inv.items) {
          if (productsMatch(p.name, it.item_name)) {
            afterQty += it.quantity
            afterOmset += it.total_price || 0
            matchedSkusSet.add(it.item_name)
          }
        }
      }
    }

    const deltaQty = afterQty - beforeQty
    const deltaOmset = afterOmset - beforeOmset
    const deltaPct = beforeOmset > 0
      ? Math.round((deltaOmset / beforeOmset) * 100)
      : (afterOmset > 0 ? 100 : 0)

    totalBeforeOmset += beforeOmset
    totalAfterOmset += afterOmset

    productImpacts.push({
      product_name: p.name,
      unit: p.unit,
      before_qty: Math.max(0, beforeQty),
      before_omset: Math.max(0, beforeOmset),
      after_qty: Math.max(0, afterQty),
      after_omset: Math.max(0, afterOmset),
      delta_qty: deltaQty,
      delta_omset: deltaOmset,
      delta_pct: deltaPct,
      is_new: beforeQty === 0 && afterQty > 0,
      matched_skus: Array.from(matchedSkusSet),
    })
  }

  // Hitung invoice count yang terkait demoplot
  for (const [, invList] of storeInvoicesBefore) {
    for (const inv of invList) {
      const hasDemoplotProd = inv.items.some(it => demoplotProducts.some(p => productsMatch(p.name, it.item_name)))
      if (hasDemoplotProd) beforeInvoicesCount++
    }
  }

  for (const [, invList] of storeInvoicesAfter) {
    for (const inv of invList) {
      const hasDemoplotProd = inv.items.some(it => demoplotProducts.some(p => productsMatch(p.name, it.item_name)))
      if (hasDemoplotProd) afterInvoicesCount++
    }
  }

  // 3.6. Analisis Per-Toko dalam Radius 5 km
  const storeResults: StoreImpactResult[] = []

  for (const { store, distance } of storesInRadius) {
    const invsBefore = storeInvoicesBefore.get(store.id) || []
    const invsAfter = storeInvoicesAfter.get(store.id) || []

    let storeBeforeOmset = 0
    for (const inv of invsBefore) storeBeforeOmset += inv.omset

    let storeAfterOmset = 0
    for (const inv of invsAfter) storeAfterOmset += inv.omset

    // Cek pembelian produk demplot oleh toko ini di periode After
    const impactProductsMap = new Map<string, StoreImpactItem>()
    let impactTotalQty = 0
    let impactTotalOmset = 0

    for (const inv of invsAfter) {
      for (const it of inv.items) {
        for (const p of demoplotProducts) {
          if (productsMatch(p.name, it.item_name)) {
            // Cek apakah produk ini baru bagi toko ini (tidak pernah beli di periode Before)
            const boughtBefore = invsBefore.some(bInv => bInv.items.some(bIt => productsMatch(p.name, bIt.item_name)))
            const existing = impactProductsMap.get(it.item_name)
            const qty = it.quantity
            const omset = it.total_price || 0

            if (existing) {
              existing.quantity += qty
              existing.omset += omset
            } else {
              impactProductsMap.set(it.item_name, {
                product_name: it.item_name,
                quantity: qty,
                omset,
                unit: it.unit || p.unit,
                is_new: !boughtBefore,
              })
            }
            impactTotalQty += qty
            impactTotalOmset += omset
          }
        }
      }
    }

    const hasImpact = impactProductsMap.size > 0

    storeResults.push({
      customer_id: store.id,
      customer_no: store.customerNo,
      name: store.name,
      city: store.city,
      region: store.region,
      default_salesman: store.defaultSalesman,
      latitude: store.latitude!,
      longitude: store.longitude!,
      distance_km: distance,
      has_impact: hasImpact,
      impact_total_qty: impactTotalQty,
      impact_total_omset: impactTotalOmset,
      impact_products: Array.from(impactProductsMap.values()),
      before_total_omset: Math.max(0, storeBeforeOmset),
      after_total_omset: Math.max(0, storeAfterOmset),
    })
  }

  // Urutkan toko terdampak di paling atas, kemudian berdasarkan jarak terdekat
  storeResults.sort((a, b) => {
    if (a.has_impact !== b.has_impact) return a.has_impact ? -1 : 1
    return a.distance_km - b.distance_km
  })

  const impactedStoresCount = storeResults.filter(s => s.has_impact).length
  const deltaOmsetTotal = totalAfterOmset - totalBeforeOmset
  const deltaPctTotal = totalBeforeOmset > 0
    ? Math.round((deltaOmsetTotal / totalBeforeOmset) * 100)
    : (totalAfterOmset > 0 ? 100 : 0)

  // Status dampak keseluruhan
  const hasOverallImpact = impactedStoresCount > 0 || (totalAfterOmset > totalBeforeOmset && totalAfterOmset > 0)

  // Format label lokasi
  const locationParts = [dp.area, dp.farmer?.address].filter(Boolean)
  const locationLabel = locationParts.join(', ') || 'Lokasi Demplot'

  return {
    demoplot: {
      id: dp.id,
      farmerName: dp.farmer?.name || 'Petani',
      commodity: dp.commodity || dp.request?.commodity || 'Padi',
      date: dp.date.toISOString().slice(0, 10),
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
      days: windowDays,
      before_start: beforeStart.toISOString().slice(0, 10),
      before_end: beforeEnd.toISOString().slice(0, 10),
      after_start: afterStart.toISOString().slice(0, 10),
      after_end: afterEnd.toISOString().slice(0, 10),
    },
    summary: {
      has_impact: hasOverallImpact,
      before_omset: totalBeforeOmset,
      before_invoices_count: beforeInvoicesCount,
      after_omset: totalAfterOmset,
      after_invoices_count: afterInvoicesCount,
      delta_omset: deltaOmsetTotal,
      delta_pct: deltaPctTotal,
      total_stores_in_radius: storesInRadius.length,
      impacted_stores_count: impactedStoresCount,
    },
    product_impacts: productImpacts,
    stores: storeResults,
  }
}

// -------------------------------------------------------------
// 4. Daftar Demplot untuk Peta (dengan Indikator Dampak Ringan)
// -------------------------------------------------------------
export async function getDemoplotsWithImpactSummary(fromDate?: string, toDate?: string) {
  const whereClause: any = {
    latitude: { not: null },
    longitude: { not: null },
  }

  if (fromDate || toDate) {
    whereClause.date = {}
    if (fromDate) whereClause.date.gte = new Date(`${fromDate}T00:00:00.000Z`)
    if (toDate) whereClause.date.lte = new Date(`${toDate}T23:59:59.999Z`)
  }

  const demoPlots = await prisma.demoPlot.findMany({
    where: whereClause,
    include: {
      farmer: { select: { name: true } },
      request: {
        select: {
          id: true,
          commodity: true,
          fo: { select: { name: true } }
        }
      },
      details: {
        include: {
          product: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Grouping by requestId: ambil titik terbaru
  const groupMap = new Map<string, (typeof demoPlots)[0]>()
  for (const dp of demoPlots) {
    if (dp.latitude === null || dp.longitude === null) continue
    const key = dp.requestId ? `req_${dp.requestId}` : `dp_${dp.id}`
    if (!groupMap.has(key)) {
      groupMap.set(key, dp)
    }
  }

  // Ambil semua invoice sesudah 6 bulan terakhir untuk quick pre-filtering
  const recentInvoices = await prisma.dashboardInvoice.findMany({
    select: {
      customerId: true,
      namaToko: true,
      items: true,
      tanggal: true,
    },
    take: 5000,
    orderBy: { tanggal: 'desc' }
  })

  // Pre-load customers dengan coords
  const customers = await prisma.dashboardCustomer.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { id: true, name: true, latitude: true, longitude: true }
  })

  const results = Array.from(groupMap.values()).map(dp => {
    const products = Array.from(new Set(dp.details.map(d => d.product?.name).filter(Boolean) as string[]))

    // Cek toko di radius 5 km
    const storesNearby = customers.filter(c => {
      if (c.latitude === null || c.longitude === null) return false
      return haversineKm(dp.latitude!, dp.longitude!, c.latitude, c.longitude) <= 5
    })

    let hasImpact = false
    if (storesNearby.length > 0 && products.length > 0) {
      const dpTime = new Date(dp.date).getTime()
      const afterEndTime = dpTime + 60 * 24 * 60 * 60 * 1000
      const storeNameSet = new Set(storesNearby.map(s => norm(s.name)))
      const storeIdSet = new Set(storesNearby.map(s => s.id))

      hasImpact = recentInvoices.some(inv => {
        const invTime = new Date(inv.tanggal).getTime()
        if (invTime < dpTime || invTime > afterEndTime) return false
        const isStoreMatch = (inv.customerId && storeIdSet.has(inv.customerId)) || storeNameSet.has(norm(inv.namaToko || ''))
        if (!isStoreMatch) return false

        const items = Array.isArray(inv.items) ? (inv.items as any[]) : []
        return items.some(it => products.some(p => productsMatch(p, it.item_name)))
      })
    }

    return {
      id: dp.id,
      farmerName: dp.farmer?.name || 'Petani',
      commodity: dp.commodity || dp.request?.commodity || 'Padi',
      date: dp.date.toISOString().slice(0, 10),
      area: dp.area || '-',
      foName: dp.request?.fo?.name || '-',
      latitude: dp.latitude!,
      longitude: dp.longitude!,
      productCount: products.length,
      products,
      has_impact: hasImpact,
    }
  })

  return results
}

// -------------------------------------------------------------
// 5. Riwayat Transaksi Toko 12 Bulan Terakhir (Modal)
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
// 6. Produk Paling Sering Dipakai di Kegiatan Demo Plot & Lapangan
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
