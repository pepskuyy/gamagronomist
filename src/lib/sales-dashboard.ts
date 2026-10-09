import prisma from '@/lib/prisma'

const BASE_URL = (process.env.SALES_DASHBOARD_URL || 'https://sales.gamaagrosejati.co.id').replace(/\/$/, '')
const API_KEY = process.env.SALES_DASHBOARD_API_KEY || ''

export interface ApiCustomer {
  id: string
  name: string
  city?: string | null
  region?: string | null
  default_salesman?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ApiInvoiceItem {
  item_no?: string
  item_name: string
  quantity: number
  unit?: string
  unit_price?: number
  total_price?: number
  dpp_amount?: number
  tax_amount?: number
}

export interface ApiInvoice {
  id_invoice: string
  tanggal: string
  nama_toko: string
  nama_sales?: string | null
  master_salesman?: string | null
  status?: string | null
  omset: number
  omset_raw?: string | number | null
  items?: ApiInvoiceItem[]
}

function getHeaders() {
  if (!API_KEY) {
    throw new Error('SALES_DASHBOARD_API_KEY belum dikonfigurasi di environment variables.')
  }
  return {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  }
}

function normName(s?: string | null): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Tarik master pelanggan yang memiliki titik GPS dari Sales Dashboard Open API
 * Menggunakan partisi multi-query (base + region + sales) untuk mengatasi limit 1000 item per request
 */
export async function fetchSalesCustomers(): Promise<ApiCustomer[]> {
  const headers = getHeaders()
  const customerMap = new Map<string, ApiCustomer>()

  // 1. Base query (ambil toko-toko teratas)
  try {
    const url = `${BASE_URL}/api/v1/customers?with_coords=1&limit=1000`
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      for (const c of (json?.data || [])) {
        if (c.id && c.name) customerMap.set(c.id, c)
      }
    }
  } catch (err) {
    console.warn('[Sales Sync] Error base customers query:', err)
  }

  // 2. Query per region utama (Jawa Timur, NTB, Jawa Tengah)
  const regions = ['Jawa Timur', 'NTB', 'Jawa Tengah']
  for (const r of regions) {
    try {
      const url = `${BASE_URL}/api/v1/customers?with_coords=1&limit=1000&region=${encodeURIComponent(r)}`
      const res = await fetch(url, { headers, cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        for (const c of (json?.data || [])) {
          if (c.id && c.name) customerMap.set(c.id, c)
        }
      }
    } catch (err) {
      console.warn(`[Sales Sync] Error region ${r} query:`, err)
    }
    await new Promise((res) => setTimeout(res, 80))
  }

  // 3. Query per salesperson dari /api/v1/users (menarik seluruh toko yang dipegang sales)
  try {
    const usersRes = await fetch(`${BASE_URL}/api/v1/users`, { headers, cache: 'no-store' })
    if (usersRes.ok) {
      const usersJson = await usersRes.json()
      const users = (usersJson?.data || []) as Array<{ name?: string; username?: string }>

      for (const u of users) {
        const salesName = u.name || u.username
        if (!salesName) continue
        try {
          const url = `${BASE_URL}/api/v1/customers?with_coords=1&limit=1000&sales=${encodeURIComponent(salesName)}`
          const res = await fetch(url, { headers, cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            for (const c of (json?.data || [])) {
              if (c.id && c.name) customerMap.set(c.id, c)
            }
          }
        } catch {}
        await new Promise((res) => setTimeout(res, 60))
      }
    }
  } catch (err) {
    console.warn('[Sales Sync] Error fetching users list:', err)
  }

  return Array.from(customerMap.values())
}

/**
 * Tarik faktur penjualan beserta rincian item dalam rentang tanggal
 */
export async function fetchSalesInvoices(from: string, to: string): Promise<ApiInvoice[]> {
  const url = `${BASE_URL}/api/v1/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&include_items=1&limit=1000`
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gagal fetch invoices (${from} s/d ${to}): HTTP ${res.status} ${errText}`)
  }
  const json = await res.json()
  return Array.isArray(json?.data) ? json.data : []
}

/**
 * Sinkronisasi tabel dashboard_customers lokal secara batch (cepat & lengkap ~2980 toko)
 */
export async function syncSalesCustomers(): Promise<{ total: number; upserted: number }> {
  console.log('[Sales Sync] Mengambil seluruh master pelanggan berkoordinat dari API (multi-partition)...')
  const customers = await fetchSalesCustomers()
  console.log(`[Sales Sync] Diterima total ${customers.length} toko/pelanggan unik. Menyimpan ke database...`)

  const formattedData = customers.map((c) => ({
    id: c.id,
    name: c.name.trim(),
    city: c.city || null,
    region: c.region || null,
    defaultSalesman: c.default_salesman || null,
    latitude: c.latitude ? Number(c.latitude) : null,
    longitude: c.longitude ? Number(c.longitude) : null,
  }))

  // Batch replace di dalam transaksi: hapus & createMany (hanya ~1 detik untuk 3000 toko)
  await prisma.$transaction([
    prisma.dashboardCustomer.deleteMany({}),
    prisma.dashboardCustomer.createMany({
      data: formattedData,
      skipDuplicates: true,
    }),
  ])

  return { total: customers.length, upserted: customers.length }
}

/**
 * Format Date ke string YYYY-MM-DD
 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Sinkronisasi tabel dashboard_invoices lokal
 * Memecah rentang waktu menjadi potongan 7 hari agar tidak melebihi limit 1000 faktur per request API
 */
export async function syncSalesInvoices(
  fromDate?: string,
  toDate?: string
): Promise<{ total: number; chunks: number }> {
  const end = toDate ? new Date(toDate) : new Date()
  const start = fromDate ? new Date(fromDate) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)

  console.log(`[Sales Sync] Memulai sinkronisasi faktur dari ${formatDate(start)} s/d ${formatDate(end)}...`)

  // Pre-load map pelanggan lokal (normName -> customer.id) untuk menautkan customerId
  const dbCustomers = await prisma.dashboardCustomer.findMany({
    select: { id: true, name: true },
  })
  const custMap = new Map<string, string>()
  for (const c of dbCustomers) {
    custMap.set(normName(c.name), c.id)
  }

  // Pecah rentang tanggal ke dalam chunk 7 hari
  const chunks: { from: string; to: string }[] = []
  let currentStart = new Date(start)

  while (currentStart < end) {
    const currentEnd = new Date(Math.min(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000, end.getTime()))
    chunks.push({
      from: formatDate(currentStart),
      to: formatDate(currentEnd),
    })
    currentStart = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000)
  }

  let totalInvoices = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`[Sales Sync] Chunk ${i + 1}/${chunks.length}: ${chunk.from} s/d ${chunk.to}`)
    const invoices = await fetchSalesInvoices(chunk.from, chunk.to)

    for (const inv of invoices) {
      if (!inv.id_invoice || !inv.tanggal) continue

      const normToko = normName(inv.nama_toko)
      const matchedCustId = custMap.get(normToko) || null
      const omsetVal = Number(inv.omset) || (Number(inv.omset_raw) || 0)
      const salesName = inv.nama_sales || inv.master_salesman || null

      await prisma.dashboardInvoice.upsert({
        where: { id: inv.id_invoice },
        update: {
          customerId: matchedCustId,
          namaToko: inv.nama_toko || null,
          namaSales: salesName,
          tanggal: new Date(inv.tanggal),
          status: inv.status || null,
          omset: omsetVal,
          items: (inv.items || []) as any,
        },
        create: {
          id: inv.id_invoice,
          customerId: matchedCustId,
          namaToko: inv.nama_toko || null,
          namaSales: salesName,
          tanggal: new Date(inv.tanggal),
          status: inv.status || null,
          omset: omsetVal,
          items: (inv.items || []) as any,
        },
      })
      totalInvoices++
    }

    // Beri jeda kecil agar sopan ke server API
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`[Sales Sync] Selesai: ${totalInvoices} faktur berhasil disinkronkan.`)
  return { total: totalInvoices, chunks: chunks.length }
}

/**
 * Jalankan sinkronisasi lengkap: Toko + Faktur
 */
export async function runFullSalesSync(fromDate?: string, toDate?: string) {
  const custRes = await syncSalesCustomers()
  const invRes = await syncSalesInvoices(fromDate, toDate)
  return {
    customers: custRes,
    invoices: invRes,
  }
}
