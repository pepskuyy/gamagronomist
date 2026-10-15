import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'
import { getDemoplotsWithImpactSummary, getTopDemoplotProducts } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const type = (url.searchParams.get('type') as any) || 'demoplot'

    const [demoplots, topProducts] = await Promise.all([
      getDemoplotsWithImpactSummary(from, to),
      getTopDemoplotProducts(10, from, to, type),
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
