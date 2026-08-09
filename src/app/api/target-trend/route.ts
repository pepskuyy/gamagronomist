import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getTargetTrendData } from '@/app/actions/kpi-trend'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const areaIdParam  = searchParams.get('areaId')
    const activityType = searchParams.get('activityType') || 'all'
    const areaId = (!areaIdParam || areaIdParam === 'all') ? null : areaIdParam

    const now = new Date()
    const fromMonth = parseInt(searchParams.get('fromMonth') || '') || (now.getMonth() - 4 + 12) % 12 + 1
    const fromYear  = parseInt(searchParams.get('fromYear')  || '') || (now.getMonth() < 5 ? now.getFullYear() - 1 : now.getFullYear())
    const toMonth   = parseInt(searchParams.get('toMonth')   || '') || (now.getMonth() + 1)
    const toYear    = parseInt(searchParams.get('toYear')    || '') || now.getFullYear()

    const data = await getTargetTrendData(areaId, activityType, fromMonth, fromYear, toMonth, toYear)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[target-trend]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
