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
  quantity?: number  // stok dalam satuan kemasan (field 'quantity' di Accurate)
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
    url.searchParams.set('fields',      'id,no,name,quantity')
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

// ─── SALES INVOICE (OUTBOUND) ─────────────────────────────────────

export type InvoiceLineItem = {
  itemNo:   string   // SKU / no_barang di Accurate (= product.accurateId)
  quantity: number   // Jumlah dalam satuan kemasan
  unitPrice?: number // Harga satuan (opsional, default 0 untuk transfer internal)
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
  description?: string
): Promise<{ success: boolean; invoiceNo?: string; error?: string; rawResponse?: any }> {
  const { token, secret, host } = getCredentials()

  const url = `${host}/accurate/api/sales-invoice/save.do`
  const headers = buildAuthHeaders(token, secret)

  // Build form-urlencoded body following Accurate's convention
  const params = new URLSearchParams()
  params.set('customerNo', customerNo)
  params.set('transDate', transDate)
  if (description) params.set('description', description)

  // Line items use indexed array parameters: detailItem[0].itemNo, detailItem[0].quantity, etc.
  items.forEach((item, idx) => {
    params.set(`detailItem[${idx}].itemNo`, item.itemNo)
    params.set(`detailItem[${idx}].quantity`, String(item.quantity))
    if (item.unitPrice !== undefined) {
      params.set(`detailItem[${idx}].unitPrice`, String(item.unitPrice))
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

