import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateCustomers } from '@/lib/accurate'

/**
 * GET /api/bd-customers
 * Mengambil daftar customer dari Accurate yang ditangani oleh "Busdev"
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (session?.role !== 'BD' && session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const customers = await fetchAccurateCustomers()
    
    // Filter by salesperson "Busdev" (case-insensitive)
    const bdCustomers = customers.filter(c => {
      const spName = c.defaultSalesman?.name?.toLowerCase() || ''
      return spName.includes('busdev')
    })

    return NextResponse.json({ customers: bdCustomers })
  } catch (err: any) {
    console.error('[bd-customers] error:', err)
    return NextResponse.json({ error: 'Gagal mengambil data customer BD: ' + (err.message ?? 'Unknown error') }, { status: 500 })
  }
}
