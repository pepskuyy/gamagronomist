'use server'

import { createHmac } from 'crypto'

// src/lib/accurate.ts
// Helper library untuk integrasi Accurate Online API

const ACCURATE_AUTH_URL = 'https://account.accurate.id'

/**
 * Ambil credentials dari environment variables dengan validasi
 */
function getCredentials() {
  const token   = process.env.ACCURATE_API_TOKEN
  const secret  = process.env.ACCURATE_SIGNATURE_SECRET
  const dbIdRaw = process.env.ACCURATE_DB_ID

  if (!token)   throw new Error('ACCURATE_API_TOKEN belum di-set di environment variables.')
  if (!secret)  throw new Error('ACCURATE_SIGNATURE_SECRET belum di-set di environment variables.')
  if (!dbIdRaw) throw new Error('ACCURATE_DB_ID belum di-set di environment variables.')

  const dbId = parseInt(dbIdRaw, 10)
  if (isNaN(dbId)) throw new Error(`ACCURATE_DB_ID harus berupa angka integer, bukan "${dbIdRaw}".`)

  return { token, secret, dbId }
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
    'Authorization':     `Bearer ${token}`,
    'X-Api-Timestamp':   timestamp,
    'X-Api-Signature':   signature,
  }
}

/**
 * Buka database Accurate dan dapatkan Host + Session ID.
 * Harus dipanggil sebelum setiap sesi API Accurate.
 */
export async function openAccurateSession(): Promise<{ host: string; session: string }> {
  const { token, secret, dbId } = getCredentials()
  const headers = buildAuthHeaders(token, secret)

  // PENTING: id harus integer (bukan string)
  const url = `${ACCURATE_AUTH_URL}/api/open-db.do?id=${dbId}`

  const res = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gagal membuka session Accurate (HTTP ${res.status}): ${text}`)
  }

  const data = await res.json()

  if (!data.s) {
    throw new Error(`Accurate API error saat open-db: ${JSON.stringify(data)}`)
  }

  return {
    host:    data.host,
    session: data.session,
  }
}

export type AccurateItem = {
  id:   number  // Internal Accurate item ID
  no:   string  // no_barang / SKU
  name: string  // nama barang
}

/**
 * Ambil semua item/barang dari Accurate Online dengan auto-paginasi.
 * Hanya mengambil field: id, no, name.
 */
export async function fetchAccurateItems(): Promise<AccurateItem[]> {
  const { token, secret } = getCredentials()
  const { host, session } = await openAccurateSession()

  const allItems: AccurateItem[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields',      'id,no,name')
    url.searchParams.set('sp.page',     String(page))
    url.searchParams.set('sp.pageSize', String(pageSize))

    // Buat headers baru tiap request agar timestamp selalu fresh
    const headers = {
      ...buildAuthHeaders(token, secret),
      'X-Session-ID': session,
    }

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
