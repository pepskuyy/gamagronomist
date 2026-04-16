import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getKabupatenFromCoords } from '@/lib/geocode'

// GET /api/admin/geocode-test?lat=X&lng=Y
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') || '')
  const lng = parseFloat(url.searchParams.get('lng') || '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat dan lng harus berupa angka valid' }, { status: 400 })
  }

  // Call Nominatim directly to get full address detail
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=id`
    const res = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'Gamagronomist/1.0', 'Accept': 'application/json' },
      next: { revalidate: 0 }
    })
    const data = await res.json()
    const addr = data.address || {}

    const kabupaten = await getKabupatenFromCoords(lat, lng)

    return NextResponse.json({
      success: true,
      input: { lat, lng },
      nominatim: {
        displayName: data.display_name,
        county:      addr.county || null,
        city:        addr.city || null,
        town:        addr.town || null,
        district:    addr.district || null,
        state:       addr.state || null,
      },
      resolvedKabupaten: kabupaten, // ← ini yang harus dimasukkan ke coverage
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
