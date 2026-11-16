import { NextResponse } from 'next/server'
import { requireFieldSession } from '@/lib/field-api'
import { getRegencies, getDistricts, getVillages } from '@/app/actions/region'

export const dynamic = 'force-dynamic'

/**
 * Data wilayah untuk App Lapangan, lewat fungsi yang sama dengan web (termasuk patch Desa Brumbung),
 * supaya app tidak bergantung langsung pada situs pihak ketiga.
 *   ?level=regencies&parent=33 | ?level=districts&parent=<kabId> | ?level=villages&parent=<kecId>
 */
export async function GET(req: Request) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const sp = new URL(req.url).searchParams
  const parent = sp.get('parent') ?? ''
  if (!/^\d{2,10}$/.test(parent)) return NextResponse.json({ error: 'parent tidak valid' }, { status: 400 })
  const fn = { regencies: getRegencies, districts: getDistricts, villages: getVillages }[sp.get('level') ?? '']
  if (!fn) return NextResponse.json({ error: 'level tidak valid' }, { status: 400 })
  return NextResponse.json(await fn(parent), { headers: { 'Cache-Control': 'private, max-age=86400' } })
}
