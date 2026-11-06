import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'
import { getAllStores } from '@/lib/data-cache'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  // Master toko di-cache (tag 'stores'); di-invalidasi pada CRUD toko & sync Accurate
  const stores = await getAllStores()

  // ?gps=sales (peta Dashboard): daftar & koordinat toko dari Sales Dashboard (sync harian),
  // sama dengan peta Sales Dashboard. Salinan Accurate (Store) hanya disinkron manual dan
  // GPS-nya bisa salah ketik (mis. Kupang -1.0117 alih-alih -10.117); dipakai untuk alamat/telp.
  // Master Toko tetap memakai data Accurate.
  if (new URL(req.url).searchParams.get('gps') === 'sales') {
    const sd = await prisma.dashboardCustomer.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, customerNo: true, name: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    })
    const byCode = new Map(stores.map(s => [(s.code || s.accurateId || '').trim(), s]))
    return NextResponse.json(sd.map(c => {
      const s = c.customerNo ? byCode.get(c.customerNo.trim()) : undefined
      return {
        id: s?.id ?? c.id,
        name: c.name,
        code: c.customerNo ?? s?.code ?? null,
        address: s?.address ?? null,
        phone: s?.phone ?? null,
        latitude: c.latitude,
        longitude: c.longitude,
      }
    }))
  }

  return NextResponse.json(stores)
}
