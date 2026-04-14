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

    // Load existing stores indexed by accurateId
    const existing = await prisma.store.findMany({ select: { id: true, accurateId: true } })
    const byAccurateId = new Map(existing.map(s => [s.accurateId, s]))

    let inserted = 0, updated = 0, skipped = 0

    for (const c of customers) {
      const no   = String(c.no   ?? '').trim()
      const name = String(c.name ?? '').trim()
      if (!name) { skipped++; continue }

      const accurateId = no || String(c.id)

      // Parse lat/lng from charfield3/charfield4 — stored as string in Accurate
      const latRaw = String(c.charfield4 ?? '').trim()
      const lngRaw = String(c.charfield3 ?? '').trim()
      const latitude  = latRaw  && latRaw  !== '0' ? parseFloat(latRaw)  : null
      const longitude = lngRaw  && lngRaw  !== '0' ? parseFloat(lngRaw)  : null

      const storeData = {
        name,
        code:      no || null,
        phone:     c.mobilePhone || null,
        latitude:  latitude  && !isNaN(latitude)  ? latitude  : null,
        longitude: longitude && !isNaN(longitude) ? longitude : null,
      }

      const found = byAccurateId.get(accurateId)
      if (found) {
        await prisma.store.update({ where: { id: found.id }, data: storeData })
        updated++
      } else {
        await prisma.store.create({ data: { ...storeData, accurateId } })
        inserted++
      }
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
