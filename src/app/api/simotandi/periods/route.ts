import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getSimotandiPeriods } from '@/lib/data-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/simotandi/periods
 * Daftar periode SIMOTANDI yang sudah tersinkron, terbaru lebih dulu.
 */
export async function GET() {
  try {
    const session = await decrypt((await cookies()).get('session')?.value as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Data sinkron harian → di-cache (tag 'simotandi', di-invalidasi setelah sync)
    const periods = await getSimotandiPeriods()

    return NextResponse.json(periods)
  } catch (err) {
    console.error('[simotandi/periods]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
