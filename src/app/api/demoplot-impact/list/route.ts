import { NextResponse } from 'next/server'
import { getDemoplotsWithImpactSummary, getTopDemoplotProducts } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined

    const [demoplots, topProducts] = await Promise.all([
      getDemoplotsWithImpactSummary(from, to),
      getTopDemoplotProducts(10, from, to),
    ])

    return NextResponse.json({
      total: demoplots.length,
      demoplots,
      topProducts,
      from,
      to,
    })
  } catch (err: any) {
    console.error('[API demoplot-impact/list] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal memuat daftar kegiatan demoplot.' },
      { status: 500 }
    )
  }
}
