import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getLatestSimotandiPeriodeId, getSimotandiData } from '@/lib/data-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/simotandi/data?periode=<id>[&kdkb=<kode>]
 *
 * Selalu mengembalikan baris provinsi + kabupaten.
 * Jika `kdkb` diberikan, sekaligus mengembalikan baris kecamatan kabupaten tsb.
 * Hanya untuk provinsi Jawa Tengah (33), DIY (34), Jawa Timur (35).
 *
 * Data sinkron harian → query di-cache (tag 'simotandi', di-invalidasi
 * setelah runSimotandiSync). Auth tetap dicek per request.
 */
export async function GET(req: Request) {
  try {
    const session = await decrypt((await cookies()).get('session')?.value as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const periodeParam = searchParams.get('periode')
    const kdkb = searchParams.get('kdkb')

    const periode = periodeParam
      ? parseInt(periodeParam, 10)
      : await getLatestSimotandiPeriodeId()

    if (!periode || !Number.isFinite(periode)) {
      return NextResponse.json({ periode: null, provinsi: [], kabupaten: [], kecamatan: [] })
    }

    const result = await getSimotandiData(periode, kdkb || null)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[simotandi/data]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
