import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
// Tambah maxDuration untuk Vercel Pro (60s). Hobby tetap 10s tapi per-page sudah cukup.
export const maxDuration = 60

/**
 * POST /api/accurate-sync-customers?page=1
 * 
 * Sync incremental: satu request = satu halaman (100 customer) dari Accurate.
 * Frontend memanggil berulang sampai done=true.
 * 
 * Response:
 *   { done: false, page, processedPage, total, inserted, updated, skipped }
 *   { done: true,  page, processedPage, total, inserted, updated, skipped, message }
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya ADMIN/SPV.' }, { status: 403 })
    }

    // Ambil page dari query param (?page=1)
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = 100

    // ── Fetch SATU halaman saja dari Accurate ──────────────────────────
    const token  = process.env.ACCURATE_API_TOKEN!
    const secret = process.env.ACCURATE_SIGNATURE_SECRET!
    const host   = (process.env.ACCURATE_HOST ?? 'https://public.accurate.id').replace(/\/$/, '')

    const timestamp = new Date().toISOString()
    const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
    const headers = {
      'Authorization':   `Bearer ${token}`,
      'X-Api-Timestamp': timestamp,
      'X-Api-Signature': signature,
    }

    const accurateUrl = new URL(`${host}/accurate/api/customer/list.do`)
    accurateUrl.searchParams.set('fields',      'id,customerNo,name,mobilePhone,billAddress,charField3,charField4,defaultSalesman')
    accurateUrl.searchParams.set('sp.page',     String(page))
    accurateUrl.searchParams.set('sp.pageSize', String(pageSize))

    const res = await fetch(accurateUrl.toString(), { headers, cache: 'no-store' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Accurate API error (HTTP ${res.status}): ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    if (!data.s) throw new Error(`Accurate API: ${JSON.stringify(data).slice(0, 200)}`)

    const customers: any[] = data.d ?? []
    const totalRows: number = data.sp?.rowCount ?? customers.length
    const totalPages = Math.ceil(totalRows / pageSize)

    // ── Batch upsert ke DB ─────────────────────────────────────────────
    let inserted = 0, updated = 0, skipped = 0
    const seen = new Set<string>()

    for (const c of customers) {
      const customerNo = String(c.customerNo ?? '').trim()
      const name       = String(c.name       ?? '').trim()
      if (!name) { skipped++; continue }

      const accurateId = customerNo || String(c.id)
      if (seen.has(accurateId)) { skipped++; continue }
      seen.add(accurateId)

      const latRaw = String(c.charField4 ?? '').trim()
      const lngRaw = String(c.charField3 ?? '').trim()
      const latitude  = latRaw && latRaw !== '0' ? parseFloat(latRaw)  : null
      const longitude = lngRaw && lngRaw !== '0' ? parseFloat(lngRaw)  : null

      const storeData = {
        name,
        code:            customerNo || null,
        address:         c.billAddress?.street || c.billAddress?.address || null,
        phone:           c.mobilePhone || null,
        latitude:        latitude  && !isNaN(latitude)  ? latitude  : null,
        longitude:       longitude && !isNaN(longitude) ? longitude : null,
        defaultSalesman: c.defaultSalesman?.name || null,
      }

      const result = await prisma.store.upsert({
        where:  { accurateId },
        update: storeData,
        create: { ...storeData, accurateId },
      })

      const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000
      if (isNew) inserted++
      else updated++
    }

    const done = page >= totalPages || customers.length < pageSize

    return NextResponse.json({
      done,
      page,
      totalPages,
      processedPage: customers.length,
      total: totalRows,
      inserted,
      updated,
      skipped,
      ...(done ? { message: `Halaman ${page}/${totalPages} — sinkronisasi selesai.` } : {}),
    })

  } catch (err: any) {
    console.error('[accurate-sync-customers] error:', err)
    return NextResponse.json({
      error: 'Gagal sinkronisasi: ' + (err.message ?? 'Unknown error'),
    }, { status: 500 })
  }
}
