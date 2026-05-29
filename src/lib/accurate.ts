'use server'

import { createHmac } from 'crypto'

// src/lib/accurate.ts
// Helper library untuk integrasi Accurate Online API
//
// CATATAN: API Token yang digunakan sudah berjenis "Database-Specific Token",
// yang berarti session sudah embedded di dalamnya. Tidak perlu memanggil
// open-db.do. Panggil endpoint data langsung dengan token + signature.

/**
 * Ambil credentials dari environment variables dengan validasi
 */
function getCredentials() {
  const token   = process.env.ACCURATE_API_TOKEN
  const secret  = process.env.ACCURATE_SIGNATURE_SECRET
  // Host untuk API Accurate — bisa dioverride jika menggunakan Private Cloud
  // Default: https://public.accurate.id (server shared Accurate Online)
  const host    = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

  if (!token)  throw new Error('ACCURATE_API_TOKEN belum di-set di environment variables.')
  if (!secret) throw new Error('ACCURATE_SIGNATURE_SECRET belum di-set di environment variables.')

  return { token, secret, host }
}

/**
 * Generate headers autentikasi Accurate:
 * - Authorization: Bearer {token}
 * - X-Api-Timestamp: ISO8601 UTC string
 * - X-Api-Signature: HMAC-SHA256(timestamp, signatureSecret) dalam hex
 */
function buildAuthHeaders(token: string, secret: string): Record<string, string> {
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')

  return {
    'Authorization':   `Bearer ${token}`,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
  }
}

export type AccurateItem = {
  id:        number  // Internal Accurate item ID
  no:        string  // no_barang / SKU
  name:      string  // nama barang
  availableToSell?: number  // stok dapat dijual (field 'availableToSell' di Accurate)
}

/**
 * Ambil semua item/barang dari Accurate Online dengan auto-paginasi.
 *
 * Karena token sudah berjenis database-specific (session embedded),
 * tidak perlu open-db.do atau X-Session-ID header.
 */
export async function fetchAccurateItems(): Promise<AccurateItem[]> {
  const { token, secret, host } = getCredentials()

  const allItems: AccurateItem[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields',      'id,no,name,availableToSell')
    url.searchParams.set('sp.page',     String(page))
    url.searchParams.set('sp.pageSize', String(pageSize))

    const headers = buildAuthHeaders(token, secret)

    const res = await fetch(url.toString(), { headers, cache: 'no-store' })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gagal fetch item Accurate hal ${page} (HTTP ${res.status}): ${text}`)
    }

    const data = await res.json()

    if (!data.s) {
      throw new Error(`Accurate item/list.do error: ${JSON.stringify(data)}`)
    }

    const items: AccurateItem[] = data.d ?? []
    allItems.push(...items)

    const totalRows: number = data.sp?.rowCount ?? items.length
    if (allItems.length >= totalRows || items.length < pageSize) break

    page++
  }

  return allItems
}

/**
 * Fetch stok yang tersedia untuk dijual (availableToSell) dari Accurate
 * untuk daftar item berdasarkan nomor barang (itemNo / SKU).
 *
 * availableToSell = stok fisik DIKURANGI qty yang sudah terikat pada Sales Order (SO) yang open.
 * Ini adalah nilai yang tepat untuk mendeteksi konflik: jika AFA request > availableToSell,
 * artinya ada SO yang sudah approved dan mungkin tidak bisa dipenuhi.
 *
 * @param itemNos - Array nomor barang Accurate (product.accurateId)
 * @returns Map<itemNo, availableToSell>
 */
export async function fetchAccurateStockLevels(itemNos: string[]): Promise<Map<string, number>> {
  if (itemNos.length === 0) return new Map()

  const { token, secret, host } = getCredentials()
  const stockMap = new Map<string, number>()

  const batchSize = 20
  for (let i = 0; i < itemNos.length; i += batchSize) {
    const batch = itemNos.slice(i, i + batchSize)
    const headers = buildAuthHeaders(token, secret)

    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields', 'no,availableToSell')
    url.searchParams.set('sp.pageSize', String(batch.length))
    // Filter by itemNo
    batch.forEach((no, idx) => {
      url.searchParams.set(`filter.no.val[${idx}]`, no)
    })
    url.searchParams.set('filter.no.op', 'EQUAL')

    try {
      const res = await fetch(url.toString(), { headers, cache: 'no-store' })
      const data = await res.json()
      if (data.s && Array.isArray(data.d)) {
        for (const item of data.d) {
          const no  = String(item.no ?? '').trim()
          const qty = typeof item.availableToSell === 'number' ? item.availableToSell : 0
          if (no) stockMap.set(no, qty)
        }
      }
    } catch (err) {
      console.warn('[Accurate] fetchAccurateStockLevels batch failed:', err)
    }
  }

  return stockMap
}

// ─── ITEM PRICE LOOKUP ────────────────────────────────────────────

/**
 * Fetch harga jual dari Accurate untuk satu atau beberapa item.
 * Jika priceLevelName diberikan, gunakan endpoint item-price untuk harga spesifik per kategori.
 * Fallback ke unitPrice (harga default) jika price level tidak tersedia.
 * @returns Map<itemNo, unitPrice>
 */
export async function fetchItemPrices(
  itemNos: string[],
  priceLevelName?: string
): Promise<Map<string, number>> {
  if (itemNos.length === 0) return new Map()

  const { token, secret, host } = getCredentials()
  const priceMap = new Map<string, number>()

  // ── Coba fetch harga per kategori lewat item-price/list.do ──────────
  if (priceLevelName) {
    try {
      const batchSize = 50
      for (let i = 0; i < itemNos.length; i += batchSize) {
        const batch = itemNos.slice(i, i + batchSize)
        const headers = buildAuthHeaders(token, secret)

        const url = new URL(`${host}/accurate/api/item-price/list.do`)
        url.searchParams.set('fields', 'itemNo,price,priceLevelName')
        url.searchParams.set('sp.pageSize', String(batch.length * 5)) // allow multiple price levels per item
        url.searchParams.set('filter.priceLevelName.op',    'EQUAL')
        url.searchParams.set('filter.priceLevelName.val[0]', priceLevelName)

        const res = await fetch(url.toString(), { headers, cache: 'no-store' })
        const data = await res.json()

        if (data.s && Array.isArray(data.d)) {
          for (const row of data.d) {
            const no    = String(row.itemNo ?? '').trim()
            const price = Number(row.price ?? 0)
            if (no && price > 0) priceMap.set(no, price)
          }
        }
      }
    } catch (err) {
      console.warn('[Accurate] item-price/list.do failed, falling back to unitPrice:', err)
    }

    // Jika semua item sudah dapat harga dari price level, langsung return
    if (itemNos.every(no => priceMap.has(no))) return priceMap
  }

  // ── Fallback: ambil unitPrice (harga default item) ──────────────────
  const batchSize = 20
  for (let i = 0; i < itemNos.length; i += batchSize) {
    const batch = itemNos.slice(i, i + batchSize)
    const headers = buildAuthHeaders(token, secret)

    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields', 'no,unitPrice')
    url.searchParams.set('sp.pageSize', String(batch.length))

    batch.forEach((no, idx) => {
      url.searchParams.set(`filter.no.val[${idx}]`, no)
    })
    url.searchParams.set('filter.no.op', 'EQUAL')

    try {
      const res = await fetch(url.toString(), { headers, cache: 'no-store' })
      const data = await res.json()

      if (data.s && Array.isArray(data.d)) {
        for (const item of data.d) {
          const no    = String(item.no ?? '').trim()
          const price = item.unitPrice ?? 0
          // Only set fallback if price level lookup didn't get this item
          if (no && !priceMap.has(no)) priceMap.set(no, price)
        }
      }
    } catch (err) {
      console.warn('[Accurate] Failed to fetch item prices for batch:', err)
    }
  }

  return priceMap
}

// ─── SALES INVOICE (OUTBOUND) ─────────────────────────────────────

export type InvoiceLineItem = {
  itemNo:        string   // SKU / no_barang di Accurate (= product.accurateId)
  quantity:      number   // Jumlah dalam satuan kemasan
  unitPrice?:    number   // Harga satuan (opsional, default 0 untuk transfer internal)
  warehouseName?: string  // Nama gudang sumber (contoh: 'Gudang Baik')
}

/**
 * Buat Sales Invoice di Accurate Online.
 * Digunakan saat WHM meng-approve pengajuan stok AFA agar stok gudang di Accurate berkurang.
 *
 * Endpoint: POST {host}/accurate/api/sales-invoice/save.do
 * Content-Type: application/x-www-form-urlencoded
 *
 * @param customerNo - Nomor pelanggan di Accurate (contoh: "PT Gama Agro Sejati")
 * @param transDate  - Tanggal transaksi dalam format dd/MM/yyyy
 * @param items      - Array line items
 * @param description - Keterangan transaksi (opsional)
 * @returns Data invoice yang dibuat dari response Accurate
 */
export async function createSalesInvoice(
  customerNo: string,
  transDate: string,
  items: InvoiceLineItem[],
  description?: string,
  branchName?: string,
  warehouseName?: string,  // Nama gudang sumber stok (contoh: 'Gudang Baik')
  priceLevelName?: string  // Nama Kategori Penjualan (contoh: 'CJ R2')
): Promise<{ success: boolean; invoiceNo?: string; error?: string; rawResponse?: any }> {
  const { token, secret, host } = getCredentials()

  const url = `${host}/accurate/api/sales-invoice/save.do`
  const headers = buildAuthHeaders(token, secret)

  // Build form-urlencoded body following Accurate's convention
  const params = new URLSearchParams()
  params.set('customerNo', customerNo)
  params.set('transDate', transDate)
  if (description)    params.set('description', description)
  if (branchName)     params.set('branchName', branchName)
  if (warehouseName)  params.set('warehouseName', warehouseName) // default warehouse for all lines
  if (priceLevelName) params.set('priceLevelName', priceLevelName)

  // Line items use indexed array parameters: detailItem[0].itemNo, detailItem[0].quantity, etc.
  items.forEach((item, idx) => {
    params.set(`detailItem[${idx}].itemNo`,   item.itemNo)
    params.set(`detailItem[${idx}].quantity`, String(item.quantity))
    if (item.unitPrice !== undefined) {
      params.set(`detailItem[${idx}].unitPrice`, String(item.unitPrice))
    }
    // Gudang sumber per line item — prioritas lebih tinggi dari level invoice
    const wh = item.warehouseName ?? warehouseName
    if (wh) {
      params.set(`detailItem[${idx}].warehouseName`, wh)
    }
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    })

    const data = await res.json()

    if (!res.ok || !data.s) {
      console.error('[Accurate] Sales invoice creation failed:', JSON.stringify(data))
      return {
        success: false,
        error: data.d ?? data.message ?? `HTTP ${res.status}`,
        rawResponse: data,
      }
    }

    return {
      success: true,
      invoiceNo: data.r?.number ?? data.d?.number ?? null,
      rawResponse: data,
    }
  } catch (err: any) {
    console.error('[Accurate] Sales invoice network error:', err)
    return {
      success: false,
      error: err.message || 'Network error',
    }
  }
}

// ─── CUSTOMER (TOKO) ──────────────────────────────────────────────

export type AccurateCustomer = {
  id:          number
  customerNo?: string
  name:        string
  mobilePhone?: string
  billAddress?: {
    street?:            string
    address?:           string
    city?:              string
    province?:          string
    concatFullAddress?: string
  } | null
  charField3?: string  // longitude
  charField4?: string  // latitude
  defaultSalesman?: { name?: string } | null
}

export async function fetchAccurateCustomers(): Promise<AccurateCustomer[]> {
  const { token, secret, host } = getCredentials()
  const allCustomers: AccurateCustomer[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const url = new URL(`${host}/accurate/api/customer/list.do`)
    url.searchParams.set('fields', 'id,customerNo,name,mobilePhone,billAddress,charField3,charField4,defaultSalesman')
    url.searchParams.set('sp.page',     String(page))
    url.searchParams.set('sp.pageSize', String(pageSize))

    const headers = buildAuthHeaders(token, secret)
    const res = await fetch(url.toString(), { headers, cache: 'no-store' })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gagal fetch customer Accurate hal ${page} (HTTP ${res.status}): ${text}`)
    }

    const data = await res.json()
    if (!data.s) throw new Error(`Accurate customer/list.do error: ${JSON.stringify(data)}`)

    const items: AccurateCustomer[] = data.d ?? []
    allCustomers.push(...items)

    const totalRows: number = data.sp?.rowCount ?? items.length
    if (allCustomers.length >= totalRows || items.length < pageSize) break
    page++
  }

  return allCustomers
}
