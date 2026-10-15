import prisma from '@/lib/prisma'
import { haversineKm, productsMatch, norm } from '@/lib/demoplot-impact'
import { getActiveDevelopmentProducts } from '@/lib/development-products'

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

// Quick Bounding Box check: 1 deg lat/lon ~ 111 km. 5 km ~ 0.045 deg.
function isNearbyFast(lat1: number, lon1: number, lat2: number, lon2: number, maxKm: number): boolean {
  const maxDeg = maxKm / 100 // 5km -> 0.05 deg (safety margin)
  if (Math.abs(lat1 - lat2) > maxDeg || Math.abs(lon1 - lon2) > maxDeg) {
    return false
  }
  return haversineKm(lat1, lon1, lat2, lon2) <= maxKm
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
  // allActive selalu dikembalikan utuh di summary (untuk jumlah di tombol & dropdown filter),
  // devProducts dipersempit sesuai filter produk untuk perhitungan skor.
  const allActive: DevelopmentProduct[] = await getActiveDevelopmentProducts()
  let devProducts = allActive

  // Jika ada filter spesifik produk
  if (filters?.productName) {
    devProducts = devProducts.filter((p) =>
      norm(p.name).includes(norm(filters.productName!))
    )
  }

  // JIKA TIDAK ADA PRODUK PENGEMBANGAN AKTIF:
  // Return langsung tanpa melakukan kalkulasi spasial berat
  if (devProducts.length === 0) {
    return {
      summary: {
        active_dev_products_count: allActive.length,
        active_dev_products: allActive,
        total_zones_found: 0,
        urgent_sellout_zones_count: 0,
        total_stocked_stores: 0,
        total_dev_stock_omset: 0,
      },
      zones: [],
    }
  }

  // 2. Ambil Toko berkoordinat
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
        active_dev_products_count: allActive.length,
        active_dev_products: allActive,
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
  const storeDevStockMap = new Map<string, Map<string, StockedProductItem>>()
  const storeAllOmsetMap = new Map<string, number>()

  // Pencocokan item invoice → produk fokus. Setiap baris invoice hanya dihitung untuk SATU produk fokus.
  // 1. Produk fokus ber-kode SKU: cocok jika item_no invoice sama persis (presisi per ukuran kemasan).
  // 2. Produk fokus tanpa kode: cocok berdasarkan nama (mencakup semua ukuran kemasan satu merek);
  //    nama terpanjang/terspesifik didahulukan.
  // Jika item invoice tidak punya item_no, semua produk fokus dicocokkan berdasarkan nama.
  const devByCode = new Map<string, DevelopmentProduct>()
  for (const dp of devProducts) {
    const code = dp.code?.trim().toLowerCase()
    if (code) devByCode.set(code, dp)
  }
  const bySpecificity = (a: DevelopmentProduct, b: DevelopmentProduct) => norm(b.name).length - norm(a.name).length
  const nameOnlyDev = devProducts.filter((dp) => !dp.code?.trim()).sort(bySpecificity)
  const allDevByName = [...devProducts].sort(bySpecificity)

  const matchDevProduct = (item: any): DevelopmentProduct | null => {
    const code = String(item.item_no || '').trim().toLowerCase()
    if (code) {
      return devByCode.get(code) ?? nameOnlyDev.find((dp) => productsMatch(dp.name, item.item_name)) ?? null
    }
    return allDevByName.find((dp) => productsMatch(dp.name, item.item_name)) ?? null
  }

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

    // Cek produk pengembangan di invoice
    if (Array.isArray(inv.items)) {
      for (const rawItem of inv.items as any[]) {
        if (!rawItem || !rawItem.item_name) continue

        const dp = matchDevProduct(rawItem)
        if (dp) {
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

  // 6. Ambil seluruh kegiatan Demo Plot & Spot Demplot (1 tahun terakhir)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const [demoPlots, spotDemoplots] = await Promise.all([
    prisma.demoPlot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        date: { gte: oneYearAgo },
      },
      select: {
        id: true,
        commodity: true,
        date: true,
        latitude: true,
        longitude: true,
        farmer: { select: { name: true } },
        request: { select: { commodity: true, fo: { select: { name: true } } } },
        details: { select: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    }),
    prisma.spotDemplot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        date: { gte: oneYearAgo },
      },
      select: {
        id: true,
        weeds: true,
        date: true,
        latitude: true,
        longitude: true,
        user: { select: { name: true } },
        details: { select: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 500,
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

  // 7. Spatial Clustering Cepat
  // Prioritas anchor: Toko yang memiliki stok produk fokus
  const stockedStores = storeDetails.filter((s) => s.hasDevStock)
  const candidateAnchors = stockedStores.length > 0
    ? stockedStores
    : [...storeDetails].sort((a, b) => b.totalAllOmset - a.totalAllOmset).slice(0, 40)

  // Batasi candidate anchors maksimal 50 untuk menjaga performa real-time
  const sortedAnchors = [...candidateAnchors]
    .sort((a, b) => b.totalDevOmset - a.totalDevOmset || b.totalAllOmset - a.totalAllOmset)
    .slice(0, 50)

  const visitedStoreIds = new Set<string>()
  const rawClusters: Array<{
    centroidLat: number
    centroidLng: number
    anchorStores: typeof storeDetails
  }> = []

  for (const anchor of sortedAnchors) {
    if (visitedStoreIds.has(anchor.id)) continue

    // Cari tetangga dalam radius 3.5 km menggunakan fast bounding box
    const neighbors = storeDetails.filter(
      (s) => isNearbyFast(anchor.latitude, anchor.longitude, s.latitude, s.longitude, 3.5)
    )

    neighbors.forEach((n) => visitedStoreIds.add(n.id))

    const avgLat = neighbors.reduce((acc, n) => acc + n.latitude, 0) / neighbors.length
    const avgLng = neighbors.reduce((acc, n) => acc + n.longitude, 0) / neighbors.length

    rawClusters.push({
      centroidLat: avgLat,
      centroidLng: avgLng,
      anchorStores: neighbors,
    })

    if (rawClusters.length >= 25) break // Cukup 25 klaster zona terbaik
  }

  // 8. Evaluasi setiap Cluster dalam Radius Cakupan 5 km
  const zoneList: OpportunityZone[] = []
  const nowTime = Date.now()

  for (let idx = 0; idx < rawClusters.length; idx++) {
    const cluster = rawClusters[idx]
    const cLat = cluster.centroidLat
    const cLng = cluster.centroidLng

    // Cari toko di radius 5 km dari centroid menggunakan fast bounding box
    const storesInRadius = storeDetails
      .filter((s) => isNearbyFast(cLat, cLng, s.latitude, s.longitude, 5.0))
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

    if (storesInRadius.length === 0) continue

    storesInRadius.sort((a, b) => {
      if (a.has_dev_stock !== b.has_dev_stock) return a.has_dev_stock ? -1 : 1
      return a.distance_km - b.distance_km
    })

    const stockedInRadius = storesInRadius.filter((s) => s.has_dev_stock)
    const unstockedInRadius = storesInRadius.filter((s) => !s.has_dev_stock)

    const totalDevStockOmset = stockedInRadius.reduce((acc, s) => acc + s.total_dev_omset, 0)
    const totalAllStoreOmset = storesInRadius.reduce((acc, s) => acc + s.total_all_omset_90d, 0)

    // Agregasi produk fokus yang ada di zona ini
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
      .filter((dp) => isNearbyFast(cLat, cLng, dp.latitude, dp.longitude, 5.0))
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    let lastDemoplotDaysAgo: number | null = null
    if (nearbyDemoplots.length > 0) {
      const mostRecentTime = new Date(nearbyDemoplots[0].date).getTime()
      lastDemoplotDaysAgo = Math.floor((nowTime - mostRecentTime) / (24 * 60 * 60 * 1000))
    }

    // ---------------------------------------------------------
    // RUMUS SCORING (0 - 100)
    // ---------------------------------------------------------
    let score = 0

    if (stockedInRadius.length > 0) {
      score += 35
      score += Math.min(15, stockedInRadius.length * 5)
      if (totalDevStockOmset >= 3000000) score += 5
    }

    if (lastDemoplotDaysAgo === null) {
      score += 30
    } else if (lastDemoplotDaysAgo > 180) {
      score += 25
    } else if (lastDemoplotDaysAgo > 90) {
      score += 15
    } else if (lastDemoplotDaysAgo < 60) {
      score -= 35
    }

    const pastHasDevProd = nearbyDemoplots.some((dp) =>
      dp.products.some((pName) => devProducts.some((devP) => productsMatch(devP.name, pName)))
    )
    if (!pastHasDevProd && stockedInRadius.length > 0) {
      score += 10
    }

    if (storesInRadius.length >= 6) score += 15
    else if (storesInRadius.length >= 3) score += 10
    else score += 5

    score = Math.max(5, Math.min(99, Math.round(score)))

    let urgency: OpportunityZone['urgency'] = 'HIGH_POTENTIAL'
    let urgency_label = 'Prioritas Pendampingan'
    let urgency_badge_color: OpportunityZone['urgency_badge_color'] = 'amber'
    let action_summary = ''

    if (stockedInRadius.length > 0 && (lastDemoplotDaysAgo === null || lastDemoplotDaysAgo > 60)) {
      if (score >= 70) {
        urgency = 'URGENT_SELLOUT'
        urgency_label = 'Wajib Segera Demplot (Kawal Sell-Out)'
        urgency_badge_color = 'red'
        action_summary = `${stockedInRadius.length} toko sudah memasok produk fokus (${devProductsSummary.map((d) => d.name).join(', ')}) senilai Rp ${(totalDevStockOmset / 1e6).toFixed(1)} jt. Lakukan demplot segera agar produk terserap petani dan memicu repeat order!`
      } else {
        urgency = 'HIGH_POTENTIAL'
        urgency_label = 'Kawal Penyerapan Stok'
        urgency_badge_color = 'amber'
        action_summary = `Toko telah memiliki stok produk fokus. Perlu pengawalan demplot di desa terdekat.`
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
      action_summary = `Klaster ${storesInRadius.length} toko potensial belum tersentuh produk fokus. Demplot akan membuka pasar dan pintu masuk bagi tim sales.`
    }

    const cities = Array.from(new Set(storesInRadius.map((s) => s.city).filter(Boolean)))
    const regionName = storesInRadius.find((s) => s.region)?.region || null
    const primaryCity = cities[0] || 'Wilayah Terpadu'
    const zoneTitle = `Klaster ${primaryCity} (${storesInRadius.length} Kios)`

    const salesmen = Array.from(
      new Set(storesInRadius.map((s) => s.default_salesman).filter(Boolean) as string[])
    )

    zoneList.push({
      id: `zone_${idx + 1}_${cLat.toFixed(3)}_${cLng.toFixed(3)}`,
      rank: 0,
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

  zoneList.sort((a, b) => b.score - a.score)
  zoneList.forEach((z, i) => {
    z.rank = i + 1
  })

  const topZones = zoneList.slice(0, 25)

  const urgentCount = topZones.filter((z) => z.urgency === 'URGENT_SELLOUT').length
  const totalStocked = topZones.reduce((acc, z) => acc + z.stocked_stores_count, 0)
  const totalDevOmset = topZones.reduce((acc, z) => acc + z.total_dev_stock_omset, 0)

  return {
    summary: {
      active_dev_products_count: allActive.length,
      active_dev_products: allActive,
      total_zones_found: topZones.length,
      urgent_sellout_zones_count: urgentCount,
      total_stocked_stores: totalStocked,
      total_dev_stock_omset: totalDevOmset,
    },
    zones: topZones,
  }
}
