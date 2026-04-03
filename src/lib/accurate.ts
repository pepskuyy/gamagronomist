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
  id:           number  // Internal Accurate item ID
  no:           string  // no_barang / SKU
  name:         string  // nama barang
  unitQuantity?: number // stok dalam satuan unit kemasan (field dari Accurate)
  qty?:         number  // alias yang mungkin digunakan versi lain Accurate
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
    url.searchParams.set('fields',      'id,no,name,unitQuantity')
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
