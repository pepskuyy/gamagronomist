import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'
import { getAllStores } from '@/lib/data-cache'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  // Master toko di-cache (tag 'stores'); di-invalidasi pada CRUD toko & sync Accurate
  const stores = await getAllStores()

  // ?gps=sales (peta): koordinat dari Sales Dashboard, dicocokkan lewat kode pelanggan.
  // GPS di Accurate (charField3/4) bisa salah ketik, mis. Kupang -1.0117 alih-alih -10.117,
  // sedangkan Sales Dashboard tersinkron harian dan sudah dikoreksi. Master Toko tetap data Accurate.
  if (new URL(req.url).searchParams.get('gps') === 'sales') {
    const sd = await prisma.dashboardCustomer.findMany({
      where: { customerNo: { not: null }, latitude: { not: null }, longitude: { not: null } },
      select: { customerNo: true, latitude: true, longitude: true },
    })
    const gps = new Map(sd.map(c => [c.customerNo!.trim(), c]))
    return NextResponse.json(stores.map(s => {
      const c = gps.get((s.code || s.accurateId || '').trim())
      return c ? { ...s, latitude: c.latitude, longitude: c.longitude } : s
    }))
  }

  return NextResponse.json(stores)
}
