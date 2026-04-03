import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { createHmac } from 'crypto'

/**
 * GET /api/accurate-debug
 * Endpoint sementara untuk melihat raw response dari Accurate API.
 * Gunakan untuk mengetahui nama field stok yang benar.
 * HAPUS endpoint ini setelah masalah teridentifikasi.
 */
export async function GET() {
  try {
    // Auth check
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const token  = process.env.ACCURATE_API_TOKEN
    const secret = process.env.ACCURATE_SIGNATURE_SECRET
    const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    if (!token || !secret) {
      return NextResponse.json({ error: 'Credentials belum di-set.' }, { status: 500 })
    }

    const timestamp = new Date().toISOString()
    const signature = createHmac('sha256', secret).update(timestamp).digest('hex')

    const headers = {
      'Authorization':   `Bearer ${token}`,
      'X-Api-Timestamp': timestamp,
      'X-Api-Signature': signature,
    }

    // Ambil 1 item saja untuk debug — tanpa filter fields supaya semua field terlihat
    const url = new URL(`${host}/accurate/api/item/list.do`)
    url.searchParams.set('sp.page',     '1')
    url.searchParams.set('sp.pageSize', '2') // Hanya 2 item untuk debug

    const res = await fetch(url.toString(), { headers, cache: 'no-store' })
    const raw = await res.json()

    // Juga coba ambil dengan fields tertentu untuk lihat nama field qty
    const url2 = new URL(`${host}/accurate/api/item/list.do`)
    url2.searchParams.set('fields',      'id,no,name,unitQuantity,qty,availableQuantity,quantityOnHand,quantity,stockOnHand,unit1Quantity,unitInQuantity,unitOutQuantity')
    url2.searchParams.set('sp.page',     '1')
    url2.searchParams.set('sp.pageSize', '2')

    const timestamp2 = new Date().toISOString()
    const signature2 = createHmac('sha256', secret).update(timestamp2).digest('hex')
    const headers2 = {
      'Authorization':   `Bearer ${token}`,
      'X-Api-Timestamp': timestamp2,
      'X-Api-Signature': signature2,
    }
    const res2 = await fetch(url2.toString(), { headers: headers2, cache: 'no-store' })
    const raw2 = await res2.json()

    return NextResponse.json({
      host,
      rawAllFields:     raw,
      rawSpecificFields: raw2,
      // Keys dari item pertama (jika ada)
      firstItemKeys:    raw.d?.[0] ? Object.keys(raw.d[0]) : [],
      firstItem:        raw.d?.[0] ?? null,
      firstItemWithFields: raw2.d?.[0] ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
