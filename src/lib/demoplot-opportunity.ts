import prisma from '@/lib/prisma'
import { haversineKm, productsMatch, norm } from '@/lib/demoplot-impact'

export interface DevelopmentProduct {
  id: string
  name: string
  code?: string | null
  targetCrop?: string | null
  notes?: string | null
  isActive: boolean
}

export interface StockedProductItem {
  product_name: string
  quantity: number
  omset: number
  unit: string
  last_invoice_date: string
  salesman?: string | null
}

export interface ZoneStoreItem {
  id: string
  customer_no?: string | null
  name: string
  city?: string | null
  region?: string | null
  default_salesman?: string | null
  latitude: number
  longitude: number
  distance_km: number
  has_dev_stock: boolean
  total_dev_omset: number
  total_all_omset_90d: number
  stocked_items: StockedProductItem[]
}

export interface ZoneDemoplotHistory {
  id: string
  farmer_name: string
  commodity: string
  date: string
  distance_km: number
  products: string[]
  fo_name?: string | null
}

export interface OpportunityZone {
  id: string
  rank: number
  title: string
  city?: string | null
  region?: string | null
  centroid: {
    latitude: number
    longitude: number
  }
  radius_km: number
  score: number // 0 - 100
  urgency: 'URGENT_SELLOUT' | 'EXPANSION_OPPORTUNITY' | 'HIGH_POTENTIAL' | 'ALREADY_COVERED'
  urgency_label: string
  urgency_badge_color: 'red' | 'amber' | 'emerald' | 'blue'
  action_summary: string

  total_stores_in_radius: number
  stocked_stores_count: number
  unstocked_stores_count: number
  total_dev_stock_omset: number
  total_all_store_omset_90d: number

  dev_products_summary: Array<{
    name: string
    total_qty: number
    total_omset: number
    store_count: number
  }>

  salesmen_involved: string[]
  stores: ZoneStoreItem[]
  nearby_demoplots: ZoneDemoplotHistory[]
  last_demoplot_days_ago: number | null
}

export interface OpportunityFinderResult {
  summary: {
    active_dev_products_count: number
    active_dev_products: DevelopmentProduct[]
    total_zones_found: number
    urgent_sellout_zones_count: number
    total_stocked_stores: number
    total_dev_stock_omset: number
  }
  zones: OpportunityZone[]
}

const CONFIG_KEY = 'demoplot_development_products'

/**
 * Mengambil daftar produk pengembangan yang aktif
 */
export async function getActiveDevelopmentProducts(): Promise<DevelopmentProduct[]> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    })

    if (!config?.value) return []
    const parsed: DevelopmentProduct[] = JSON.parse(config.value)
    return parsed.filter((p) => p.isActive)
  } catch (err) {
    console.warn('[demoplot-opportunity] Failed to get active dev products:', err)
    return []
  }
}

/**
 * Menghitung Opportunity Zones untuk Rekomendasi Lokasi Demo Plot Baru
 */
export async function calculateOpportunityZones(filters?: {
  region?: string
  city?: string
  salesman?: string
  productId?: string
  productName?: string
  daysWindow?: number
}): Promise<OpportunityFinderResult> {
  const days = filters?.daysWindow || 90
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // 1. Ambil Produk Pengembangan Aktif
  let devProducts = await getActiveDevelopmentProducts()

  // Jika ada filter spesifik produk
  if (filters?.productName) {
    devProducts = devProducts.filter((p) =>
      norm(p.name).includes(norm(filters.productName!))
    )
  }

  // 2. Ambil semua Toko berkoordinat
  const customerWhere: any = {
    latitude: { not: null },
    longitude: { not: null },
  }
  if (filters?.region) {
    customerWhere.region = { contains: filters.region, mode: 'insensitive' }
  }
  if (filters?.city) {
    customerWhere.city = { contains: filters.city, mode: 'insensitive' }
  }
  if (filters?.salesman) {
    customerWhere.defaultSalesman = { contains: filters.salesman, mode: 'insensitive' }
  }

  const customers = await prisma.dashboardCustomer.findMany({
    where: customerWhere,
    select: {
      id: true,
      customerNo: true,
      name: true,
      city: true,
      region: true,
      defaultSalesman: true,
      latitude: true,
      longitude: true,
    },
  })

  if (customers.length === 0) {
    return {
      summary: {
        active_dev_products_count: devProducts.length,
        active_dev_products: devProducts,
        total_zones_found: 0,
        urgent_sellout_zones_count: 0,
        total_stocked_stores: 0,
        total_dev_stock_omset: 0,
      },
      zones: [],
    }
  }

  // 3. Ambil Faktur Penjualan dalam rentang tanggal
  const invoices = await prisma.dashboardInvoice.findMany({
    where: {
      tanggal: { gte: windowStart },
      status: { not: 'Batal' },
    },
    select: {
      id: true,
      customerId: true,
      namaToko: true,
      namaSales: true,
      tanggal: true,
      status: true,
      omset: true,
      items: true,
    },
    orderBy: { tanggal: 'desc' },
  })

  // 4. Petakan transaksi per Toko
  // Map<customerId or norm(namaToko), Map<productName, StockedProductItem>>
  const storeDevStockMap = new Map<string, Map<string, StockedProductItem>>()
  const storeAllOmsetMap = new Map<string, number>()

  for (const inv of invoices) {
    const isRetur = (inv.status || '').toLowerCase().includes('retur')
    const multiplier = isRetur ? -1 : 1
    const omsetVal = (Number(inv.omset) || 0) * multiplier

    const storeKeys: string[] = []
    if (inv.customerId) storeKeys.push(inv.customerId)
    if (inv.namaToko) storeKeys.push(norm(inv.namaToko))

    // Akumulasi total omset toko
    for (const k of storeKeys) {
      storeAllOmsetMap.set(k, (storeAllOmsetMap.get(k) || 0) + omsetVal)
    }

    // Cek apakah ada produk pengembangan di invoice
    if (devProducts.length > 0 && Array.isArray(inv.items)) {
      for (const rawItem of inv.items as any[]) {
        if (!rawItem || !rawItem.item_name) continue

        for (const dp of devProducts) {
          if (productsMatch(dp.name, rawItem.item_name)) {
            const itemQty = (Number(rawItem.quantity) || 0) * multiplier
            const itemOmset = (Number(rawItem.total_price) || 0) * multiplier

            for (const k of storeKeys) {
              if (!storeDevStockMap.has(k)) {
                storeDevStockMap.set(k, new Map())
              }
              const prodMap = storeDevStockMap.get(k)!
              const existing = prodMap.get(dp.name) || {
                product_name: dp.name,
                quantity: 0,
                omset: 0,
                unit: rawItem.unit || 'PCS',
                last_invoice_date: inv.tanggal.toISOString().slice(0, 10),
                salesman: inv.namaSales || null,
              }

              existing.quantity += itemQty
              existing.omset += itemOmset
              prodMap.set(dp.name, existing)
            }
          }
        }
      }
    }
  }

  // 5. Tandai setiap toko dengan status stok produk pengembangan
  const storeDetails = customers.map((c) => {
    const devMap = storeDevStockMap.get(c.id) || storeDevStockMap.get(norm(c.name))
    const stockedItems: StockedProductItem[] = devMap
      ? Array.from(devMap.values()).filter((it) => it.quantity > 0 || it.omset > 0)
      : []

    const hasDevStock = stockedItems.length > 0
    const totalDevOmset = stockedItems.reduce((acc, it) => acc + Math.max(0, it.omset), 0)
    const totalAllOmset = Math.max(
      0,
      storeAllOmsetMap.get(c.id) || storeAllOmsetMap.get(norm(c.name)) || 0
    )

    return {
      ...c,
      latitude: c.latitude!,
      longitude: c.longitude!,
      hasDevStock,
      totalDevOmset,
      totalAllOmset,
      stockedItems,
    }
  })

  // 6. Ambil seluruh kegiatan Demo Plot & Spot Demplot yang ada koordinatnya (1 tahun terakhir)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const [demoPlots, spotDemoplots] = await Promise.all([
    prisma.demoPlot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        date: { gte: oneYearAgo },
      },
      include: {
        farmer: { select: { name: true } },
        request: { select: { commodity: true, fo: { select: { name: true } } } },
        details: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.spotDemplot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        date: { gte: oneYearAgo },
      },
      include: {
        user: { select: { name: true } },
        details: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  interface AllDemoplotItem {
    id: string
    farmerName: string
    commodity: string
    date: Date
    latitude: number
    longitude: number
    foName?: string | null
    products: string[]
  }

  const allDemoplots: AllDemoplotItem[] = [
    ...demoPlots.map((dp) => ({
      id: dp.id,
      farmerName: dp.farmer?.name || 'Petani',
      commodity: dp.commodity || dp.request?.commodity || 'Pangan/Horti',
      date: dp.date,
      latitude: dp.latitude!,
      longitude: dp.longitude!,
      foName: dp.request?.fo?.name,
      products: dp.details.map((d) => d.product?.name).filter(Boolean) as string[],
    })),
    ...spotDemoplots.map((sd) => ({
      id: sd.id,
      farmerName: 'Spot Demplot Lapangan',
      commodity: sd.weeds || 'Hama/Penyakit',
      date: sd.date,
      latitude: sd.latitude!,
      longitude: sd.longitude!,
      foName: sd.user?.name,
      products: sd.details.map((d) => d.product?.name).filter(Boolean) as string[],
    })),
  ]

  // 7. Spatial Clustering: Buat Zona Peluang
  // Anchor utama: Toko-toko yang memiliki stok produk pengembangan (Follow-the-Sales)
  // Anchor sekunder: Klaster toko padat (Retail Density)
  const stockedStores = storeDetails.filter((s) => s.hasDevStock)
  const candidateAnchors = stockedStores.length > 0 ? stockedStores : storeDetails

  // Greedy Clustering dengan radius merger 3.5 km
  const visitedStoreIds = new Set<string>()
  const rawClusters: Array<{
    centroidLat: number
    centroidLng: number
    anchorStores: typeof storeDetails
  }> = []

  // Urutkan toko berstok tertinggi terlebih dahulu
  const sortedAnchors = [...candidateAnchors].sort(
    (a, b) => b.totalDevOmset - a.totalDevOmset || b.totalAllOmset - a.totalAllOmset
  )

  for (const anchor of sortedAnchors) {
    if (visitedStoreIds.has(anchor.id)) continue

    // Cari toko tetangga dalam radius 3.5 km untuk digabung dalam satu cluster centroid
    const neighbors = storeDetails.filter(
      (s) => haversineKm(anchor.latitude, anchor.longitude, s.latitude, s.longitude) <= 3.5
    )

    neighbors.forEach((n) => visitedStoreIds.add(n.id))

    // Hitung centroid rata-rata dari cluster
    const avgLat = neighbors.reduce((acc, n) => acc + n.latitude, 0) / neighbors.length
    const avgLng = neighbors.reduce((acc, n) => acc + n.longitude, 0) / neighbors.length

    rawClusters.push({
      centroidLat: avgLat,
      centroidLng: avgLng,
      anchorStores: neighbors,
    })
  }

  // 8. Evaluasi setiap Cluster dalam Radius Cakupan 5 km
  const zoneList: OpportunityZone[] = []
  const nowTime = Date.now()

  for (let idx = 0; idx < rawClusters.length; idx++) {
    const cluster = rawClusters[idx]
    const cLat = cluster.centroidLat
    const cLng = cluster.centroidLng

    // Cari semua toko di radius 5 km dari centroid
    const storesInRadius = storeDetails
      .map((s) => {
        const dist = haversineKm(cLat, cLng, s.latitude, s.longitude)
        return {
          id: s.id,
          customer_no: s.customerNo,
          name: s.name,
          city: s.city,
          region: s.region,
          default_salesman: s.defaultSalesman,
          latitude: s.latitude,
          longitude: s.longitude,
          distance_km: Math.round(dist * 10) / 10,
          has_dev_stock: s.hasDevStock,
          total_dev_omset: s.totalDevOmset,
          total_all_omset_90d: s.totalAllOmset,
          stocked_items: s.stockedItems,
        }
      })
      .filter((s) => s.distance_km <= 5.0)

    if (storesInRadius.length === 0) continue

    // Urutkan toko: yang berstok dev paling atas, lalu yang terdekat
    storesInRadius.sort((a, b) => {
      if (a.has_dev_stock !== b.has_dev_stock) return a.has_dev_stock ? -1 : 1
      return a.distance_km - b.distance_km
    })

    const stockedInRadius = storesInRadius.filter((s) => s.has_dev_stock)
    const unstockedInRadius = storesInRadius.filter((s) => !s.has_dev_stock)

    const totalDevStockOmset = stockedInRadius.reduce((acc, s) => acc + s.total_dev_omset, 0)
    const totalAllStoreOmset = storesInRadius.reduce((acc, s) => acc + s.total_all_omset_90d, 0)

    // Agregasi produk pengembangan yang ada di zona ini
    const devProdMap = new Map<string, { total_qty: number; total_omset: number; store_count: number }>()
    for (const s of stockedInRadius) {
      for (const item of s.stocked_items) {
        const cur = devProdMap.get(item.product_name) || { total_qty: 0, total_omset: 0, store_count: 0 }
        cur.total_qty += item.quantity
        cur.total_omset += item.omset
        cur.store_count += 1
        devProdMap.set(item.product_name, cur)
      }
    }
    const devProductsSummary = Array.from(devProdMap.entries()).map(([name, data]) => ({
      name,
      ...data,
    }))

    // Cek demplot di radius 5 km
    const nearbyDemoplots: ZoneDemoplotHistory[] = allDemoplots
      .map((dp) => {
        const dist = haversineKm(cLat, cLng, dp.latitude, dp.longitude)
        return {
          id: dp.id,
          farmer_name: dp.farmerName,
          commodity: dp.commodity,
          date: dp.date.toISOString().slice(0, 10),
          distance_km: Math.round(dist * 10) / 10,
          products: dp.products,
          fo_name: dp.foName || null,
        }
      })
      .filter((dp) => dp.distance_km <= 5.0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Hitung hari sejak demplot terakhir
    let lastDemoplotDaysAgo: number | null = null
    if (nearbyDemoplots.length > 0) {
      const mostRecentTime = new Date(nearbyDemoplots[0].date).getTime()
      lastDemoplotDaysAgo = Math.floor((nowTime - mostRecentTime) / (24 * 60 * 60 * 1000))
    }

    // ---------------------------------------------------------
    // RUMUS SCORING (0 - 100)
    // ---------------------------------------------------------
    let score = 0

    // 1. Pilar Follow-The-Sales (Maks 50 Poin)
    if (stockedInRadius.length > 0) {
      score += 30 // Ada toko yang sudah kulakan produk pengembangan
      score += Math.min(15, stockedInRadius.length * 5) // +5 per toko berstok
      if (totalDevStockOmset >= 5000000) score += 5 // Nilai barang di toko cukup besar
    }

    // 2. Pilar Ketiadaan Edukasi / Blank Spot (Maks 30 Poin)
    if (lastDemoplotDaysAgo === null) {
      score += 30 // Belum pernah ada demplot sama sekali
    } else if (lastDemoplotDaysAgo > 180) {
      score += 25 // Sudah lebih dari 6 bulan nihil demplot
    } else if (lastDemoplotDaysAgo > 90) {
      score += 15 // Nihil dalam 3 bulan
    } else if (lastDemoplotDaysAgo < 60) {
      score -= 35 // Penalti: Baru saja ada demplot < 60 hari lalu (jangan duplikasi)
    }

    // Cek apakah demplot lalu pernah memakai produk pengembangan ini
    const pastHasDevProd = nearbyDemoplots.some((dp) =>
      dp.products.some((pName) => devProducts.some((devP) => productsMatch(devP.name, pName)))
    )
    if (!pastHasDevProd && stockedInRadius.length > 0) {
      score += 10 // Produk pengembangan ini benar-benar BELUM PERNAH didemplotkan di area ini!
    }

    // 3. Pilar Kepadatan Toko / Retail Gravity (Maks 20 Poin)
    if (storesInRadius.length >= 6) score += 20
    else if (storesInRadius.length >= 4) score += 15
    else if (storesInRadius.length >= 2) score += 10
    else score += 5

    // Normalisasi skor 0 - 100
    score = Math.max(5, Math.min(99, Math.round(score)))

    // ---------------------------------------------------------
    // KLASIFIKASI & URGENSI
    // ---------------------------------------------------------
    let urgency: OpportunityZone['urgency'] = 'HIGH_POTENTIAL'
    let urgency_label = 'Prioritas Pendampingan'
    let urgency_badge_color: OpportunityZone['urgency_badge_color'] = 'amber'
    let action_summary = ''

    if (stockedInRadius.length > 0 && (lastDemoplotDaysAgo === null || lastDemoplotDaysAgo > 60)) {
      if (score >= 75) {
        urgency = 'URGENT_SELLOUT'
        urgency_label = 'Wajib Segera Demplot (Kawal Sell-Out)'
        urgency_badge_color = 'red'
        action_summary = `${stockedInRadius.length} toko sudah memasok produk pengembangan (${devProductsSummary.map((d) => d.name).join(', ')}) senilai Rp ${(totalDevStockOmset / 1e6).toFixed(1)} jt. Lakukan demplot segera agar produk terserap petani dan memicu repeat order!`
      } else {
        urgency = 'HIGH_POTENTIAL'
        urgency_label = 'Kawal Penyerapan Stok'
        urgency_badge_color = 'amber'
        action_summary = `Toko telah memiliki stok produk pengembangan. Perlu pengawalan demplot di desa terdekat.`
      }
    } else if (lastDemoplotDaysAgo !== null && lastDemoplotDaysAgo <= 60) {
      urgency = 'ALREADY_COVERED'
      urgency_label = 'Wilayah Terawat (Baru Ada Demplot)'
      urgency_badge_color = 'emerald'
      action_summary = `Baru ada kegiatan demplot ${lastDemoplotDaysAgo} hari lalu. Pantau dampak penjualan di toko sekitar sebelum merencanakan demplot baru.`
    } else {
      urgency = 'EXPANSION_OPPORTUNITY'
      urgency_label = 'Peluang Penetrasi Pasar Baru'
      urgency_badge_color = 'blue'
      action_summary = `Klaster ${storesInRadius.length} toko potensial belum tersentuh produk pengembangan. Demplot akan membuka pasar dan pintu masuk bagi tim sales.`
    }

    // Nama/label klaster
    const cities = Array.from(new Set(storesInRadius.map((s) => s.city).filter(Boolean)))
    const regionName = storesInRadius.find((s) => s.region)?.region || null
    const primaryCity = cities[0] || 'Wilayah Terpadu'
    const zoneTitle = `Klaster ${primaryCity} (${storesInRadius.length} Kios)`

    const salesmen = Array.from(
      new Set(storesInRadius.map((s) => s.default_salesman).filter(Boolean) as string[])
    )

    zoneList.push({
      id: `zone_${idx + 1}_${cLat.toFixed(3)}_${cLng.toFixed(3)}`,
      rank: 0, // diisi setelah sort
      title: zoneTitle,
      city: primaryCity,
      region: regionName,
      centroid: {
        latitude: Math.round(cLat * 10000) / 10000,
        longitude: Math.round(cLng * 10000) / 10000,
      },
      radius_km: 5.0,
      score,
      urgency,
      urgency_label,
      urgency_badge_color,
      action_summary,
      total_stores_in_radius: storesInRadius.length,
      stocked_stores_count: stockedInRadius.length,
      unstocked_stores_count: unstockedInRadius.length,
      total_dev_stock_omset: totalDevStockOmset,
      total_all_store_omset_90d: totalAllStoreOmset,
      dev_products_summary: devProductsSummary,
      salesmen_involved: salesmen,
      stores: storesInRadius,
      nearby_demoplots: nearbyDemoplots,
      last_demoplot_days_ago: lastDemoplotDaysAgo,
    })
  }

  // Urutkan zona berdasarkan Skor tertinggi
  zoneList.sort((a, b) => b.score - a.score)
  zoneList.forEach((z, i) => {
    z.rank = i + 1
  })

  // Ambil top 40 zona paling potensial
  const topZones = zoneList.slice(0, 40)

  const urgentCount = topZones.filter((z) => z.urgency === 'URGENT_SELLOUT').length
  const totalStocked = topZones.reduce((acc, z) => acc + z.stocked_stores_count, 0)
  const totalDevOmset = topZones.reduce((acc, z) => acc + z.total_dev_stock_omset, 0)

  return {
    summary: {
      active_dev_products_count: devProducts.length,
      active_dev_products: devProducts,
      total_zones_found: topZones.length,
      urgent_sellout_zones_count: urgentCount,
      total_stocked_stores: totalStocked,
      total_dev_stock_omset: totalDevOmset,
    },
    zones: topZones,
  }
}
