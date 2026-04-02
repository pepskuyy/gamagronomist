'use server'

// src/lib/accurate.ts
// Helper library untuk integrasi Accurate Online API

const ACCURATE_AUTH_URL = 'https://account.accurate.id'

/**
 * Ambil API Token dari environment variables
 */
function getAccurateToken(): string {
  const token = process.env.ACCURATE_API_TOKEN
  if (!token) throw new Error('ACCURATE_API_TOKEN belum di-set di environment variables.')
  return token
}

/**
 * Buka database Accurate dan dapatkan Host + Session ID
 * Setiap sinkronisasi membutuhkan session baru.
 */
export async function openAccurateSession(): Promise<{ host: string; session: string }> {
  const token = getAccurateToken()
  const dbId = process.env.ACCURATE_DB_ID
  if (!dbId) throw new Error('ACCURATE_DB_ID belum di-set di environment variables.')

  const url = `${ACCURATE_AUTH_URL}/api/open-db.do?id=${encodeURIComponent(dbId)}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Jangan cache — session harus fresh setiap kali
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gagal membuka session Accurate (HTTP ${res.status}): ${text}`)
  }

  const data = await res.json()

  // Accurate mengembalikan { s: true, host: "...", session: "..." } jika berhasil
  if (!data.s) {
    throw new Error(`Accurate API error saat open-db: ${JSON.stringify(data)}`)
  }

  return {
    host: data.host,       // e.g. "https://public.accurate.id"
    session: data.session, // Session ID untuk dipakai di X-Session-ID header
  }
}

export type AccurateItem = {
  id: number    // Internal Accurate item ID
  no: string    // no_barang / SKU
  name: string  // nama barang
}

/**
 * Ambil semua item/barang dari Accurate Online dengan auto-paginasi.
 * Hanya mengambil field: id, no, name (SKU + nama produk).
 */
export async function fetchAccurateItems(): Promise<AccurateItem[]> {
  const token = getAccurateToken()
  const { host, session } = await openAccurateSession()

  const allItems: AccurateItem[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('fields', 'id,no,name')
    url.searchParams.set('sp.page', String(page))
    url.searchParams.set('sp.pageSize', String(pageSize))

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Session-ID': session,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gagal fetch item Accurate halaman ${page} (HTTP ${res.status}): ${text}`)
    }

    const data = await res.json()

    if (!data.s) {
      throw new Error(`Accurate item/list.do error: ${JSON.stringify(data)}`)
    }

    const items: AccurateItem[] = data.d ?? []
    allItems.push(...items)

    // Cek apakah semua data sudah diambil
    const totalRows: number = data.sp?.rowCount ?? items.length
    if (allItems.length >= totalRows || items.length < pageSize) break

    page++
  }

  return allItems
}
