import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getAreaTargetData } from '@/app/actions/kpi'

export const dynamic = 'force-dynamic'

// GET /api/target-data?areaId=...&month=...&year=...
// areaId: omit or 'all' → all areas | 'none' → Tanpa Area | '<id>' → specific area
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const areaIdParam = searchParams.get('areaId') // null/'all' → aggregate all
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))

    // null → all areas combined
    const areaId = (!areaIdParam || areaIdParam === 'all') ? null : areaIdParam

    const data = await getAreaTargetData(areaId, month, year)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[target-data]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
