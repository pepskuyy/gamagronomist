import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateCustomers } from '@/lib/accurate'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug-accurate-customers
 * Debug endpoint: menampilkan raw data customer dari Accurate untuk troubleshooting
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.role || !['ADMIN', 'SPV'].includes(session.role as string)) {
      return NextResponse.json({ error: 'Hanya ADMIN/SPV yang bisa akses endpoint debug ini.' }, { status: 403 })
    }

    const customers = await fetchAccurateCustomers()

    const sample = customers.slice(0, 20).map(c => ({
      id: c.id,
      name: c.name,
      customerNo: c.customerNo,
      defaultSalesman: c.defaultSalesman,
    }))

    const withSalesman = customers.filter(c => c.defaultSalesman?.name)
    const busdevMatch  = customers.filter(c => c.defaultSalesman?.name?.toLowerCase().includes('busdev'))

    return NextResponse.json({
      totalCustomers: customers.length,
      withSalesmanCount: withSalesman.length,
      busdevMatchCount: busdevMatch.length,
      busdevMatches: busdevMatch.slice(0, 10),
      sample20: sample,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
