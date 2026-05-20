import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateCustomers } from '@/lib/accurate'

export const dynamic = 'force-dynamic'

/**
 * In-memory cache agar tidak perlu fetch ulang 2861 pelanggan setiap request.
 * Cache berlaku selama 10 menit.
 */
let cachedCustomers: any[] | null = null
let cacheExpiry = 0

/**
 * GET /api/bd-customers
 * Mengambil daftar customer dari Accurate yang ditangani oleh "Busdev"
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.role || !['BD', 'ADMIN', 'SPV'].includes(session.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    // Gunakan cache jika masih valid (10 menit)
    const now = Date.now()
    if (!cachedCustomers || now > cacheExpiry) {
      const allCustomers = await fetchAccurateCustomers()
      cachedCustomers = allCustomers
      cacheExpiry = now + 10 * 60 * 1000
    }

    const customers = cachedCustomers

    // Filter by salesperson "Busdev" (case-insensitive)
    const bdCustomers = customers.filter((c: any) => {
      const spName = c.defaultSalesman?.name?.toLowerCase() || ''
      return spName.includes('busdev')
    })

    return NextResponse.json({ customers: bdCustomers, total: bdCustomers.length })
  } catch (err: any) {
    console.error('[bd-customers] error:', err)
    return NextResponse.json({ error: 'Gagal mengambil data customer BD: ' + (err.message ?? 'Unknown error') }, { status: 500 })
  }
}
