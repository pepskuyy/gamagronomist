import { NextResponse } from 'next/server'
import { calculateDemoplotImpact } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const radiusKm = Number(searchParams.get('radiusKm')) || 5
    const windowDays = Number(searchParams.get('windowDays')) || 60

    if (!id) {
      return NextResponse.json({ error: 'Parameter id kegiatan demoplot wajib disertakan.' }, { status: 400 })
    }

    const impact = await calculateDemoplotImpact(id, radiusKm, windowDays)

    if (!impact) {
      return NextResponse.json({ error: 'Data demoplot tidak ditemukan atau tidak memiliki koordinat GPS.' }, { status: 404 })
    }

    return NextResponse.json(impact)
  } catch (err: any) {
    console.error('[API demoplot-impact] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan saat menghitung analitik dampak demoplot.' },
      { status: 500 }
    )
  }
}
