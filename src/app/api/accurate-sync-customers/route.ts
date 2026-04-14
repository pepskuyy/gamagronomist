import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateCustomers } from '@/lib/accurate'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * POST /api/accurate-sync-customers
 * Sync customer list dari Accurate ke tabel Store.
 * Hanya ADMIN/SPV yang boleh memicu sync ini.
 * 
 * Field Accurate:
 *   charfield4 = latitude
 *   charfield3 = longitude
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya ADMIN/SPV.' }, { status: 403 })
    }

    const customers = await fetchAccurateCustomers()

    if (customers.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada customer ditemukan di Accurate.', total: 0, inserted: 0, updated: 0, skipped: 0 })
    }

    let inserted = 0, updated = 0, skipped = 0

    // Deduplicate customers from Accurate by accurateId
    // (some databases may have duplicate customerNo)
    const seen = new Set<string>()

    for (const c of customers) {
      const customerNo = String(c.customerNo ?? '').trim()
      const name       = String(c.name       ?? '').trim()
      if (!name) { skipped++; continue }

      // Use customerNo if available, otherwise fall back to Accurate's internal id
      const accurateId = customerNo || String(c.id)

      // Skip if already processed in this batch (duplicate customerNo in Accurate)
      if (seen.has(accurateId)) { skipped++; continue }
      seen.add(accurateId)

      // Parse lat/lng from charField3/charField4 — stored as string in Accurate
      const latRaw = String(c.charField4 ?? '').trim()
      const lngRaw = String(c.charField3 ?? '').trim()
      const latitude  = latRaw && latRaw !== '0' ? parseFloat(latRaw)  : null
      const longitude = lngRaw && lngRaw !== '0' ? parseFloat(lngRaw)  : null

      const storeData = {
        name,
        code:      customerNo || null,
        address:   c.billAddress || null,
        phone:     c.mobilePhone || null,
        latitude:  latitude  && !isNaN(latitude)  ? latitude  : null,
        longitude: longitude && !isNaN(longitude) ? longitude : null,
      }

      // Use upsert to safely handle both insert and update without race conditions
      const result = await prisma.store.upsert({
        where:  { accurateId },
        update: storeData,
        create: { ...storeData, accurateId },
      })

      // Determine if it was a new record (createdAt ≈ updatedAt means just created)
      const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000
      if (isNew) inserted++
      else updated++
    }

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi selesai: ${inserted} toko baru, ${updated} diperbarui, ${skipped} dilewati.`,
      total: customers.length, inserted, updated, skipped,
    })
  } catch (err: any) {
    console.error('[accurate-sync-customers] error:', err)
    return NextResponse.json({ error: 'Gagal sinkronisasi customer dari Accurate: ' + (err.message ?? 'Unknown error') }, { status: 500 })
  }
}
