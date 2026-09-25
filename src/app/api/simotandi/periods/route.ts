import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/simotandi/periods
 * Daftar periode SIMOTANDI yang sudah tersinkron, terbaru lebih dulu.
 */
export async function GET() {
  try {
    const session = await decrypt((await cookies()).get('session')?.value as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const periods = await prisma.simotandiPeriode.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, kode: true, label: true, startDate: true, endDate: true },
    })

    return NextResponse.json(periods)
  } catch (err) {
    console.error('[simotandi/periods]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
