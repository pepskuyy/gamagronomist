import { NextResponse } from 'next/server'
import { calculateOpportunityZones } from '@/lib/demoplot-opportunity'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const region = url.searchParams.get('region') || undefined
    const city = url.searchParams.get('city') || undefined
    const salesman = url.searchParams.get('salesman') || undefined
    const productName = url.searchParams.get('product') || undefined
    const daysWindow = url.searchParams.get('days')
      ? parseInt(url.searchParams.get('days')!, 10)
      : 90

    const data = await calculateOpportunityZones({
      region,
      city,
      salesman,
      productName,
      daysWindow,
    })

    return NextResponse.json({
      success: true,
      ...data,
    })
  } catch (err: any) {
    console.error('[API demoplot-impact/opportunities] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal menghitung rekomendasi zona demoplot.' },
      { status: 500 }
    )
  }
}
