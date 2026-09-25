import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SELECT = {
  level: true,
  nama: true,
  kdpr: true,
  kdkb: true,
  kdkc: true,
  bera: true,
  penyiapanLahan: true,
  tanam: true,
  veg1: true,
  veg2: true,
  gen1: true,
  gen2: true,
  panen: true,
  standingCrop: true,
  lsb: true,
} as const

/**
 * GET /api/simotandi/data?periode=<id>[&kdkb=<kode>]
 *
 * Selalu mengembalikan baris provinsi + kabupaten.
 * Jika `kdkb` diberikan, sekaligus mengembalikan baris kecamatan kabupaten tsb.
 * Hanya untuk provinsi Jawa Tengah (33), DIY (34), Jawa Timur (35).
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
      : (
          await prisma.simotandiPeriode.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true },
          })
        )?.id

    if (!periode || !Number.isFinite(periode)) {
      return NextResponse.json({ periode: null, provinsi: [], kabupaten: [], kecamatan: [] })
    }

    const [periodeInfo, provinsi, kabupaten, kecamatan] = await Promise.all([
      prisma.simotandiPeriode.findUnique({
        where: { id: periode },
        select: { id: true, kode: true, label: true, startDate: true, endDate: true },
      }),
      prisma.simotandiWilayah.findMany({ where: { periodeId: periode, level: 'provinsi' }, select: SELECT }),
      prisma.simotandiWilayah.findMany({
        where: { periodeId: periode, level: 'kabupaten' },
        select: SELECT,
        orderBy: { kdkb: 'asc' },
      }),
      kdkb
        ? prisma.simotandiWilayah.findMany({
            where: { periodeId: periode, level: 'kecamatan', kdkb },
            select: SELECT,
            orderBy: { kdkc: 'asc' },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({ periode: periodeInfo, provinsi, kabupaten, kecamatan })
  } catch (err) {
    console.error('[simotandi/data]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
