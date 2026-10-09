import { NextResponse } from 'next/server'
import { getDemoplotsWithImpactSummary, getTopDemoplotProducts } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [demoplots, topProducts] = await Promise.all([
      getDemoplotsWithImpactSummary(),
      getTopDemoplotProducts(10),
    ])

    return NextResponse.json({
      total: demoplots.length,
      demoplots,
      topProducts,
    })
  } catch (err: any) {
    console.error('[API demoplot-impact/list] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal memuat daftar kegiatan demoplot.' },
      { status: 500 }
    )
  }
}
