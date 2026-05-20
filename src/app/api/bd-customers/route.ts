import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bd-customers
 * Mengambil daftar kios/pelanggan dari DB lokal (Store) yang memiliki defaultSalesman "Busdev".
 * Jauh lebih cepat karena tidak perlu hit Accurate API.
 * Data bersumber dari tabel Store yang di-sync dari Accurate via /api/accurate-sync-customers.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.role || !['BD', 'ADMIN', 'SPV'].includes(session.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    // Ambil dari DB lokal — filter by defaultSalesman yang mengandung "busdev"
    const stores = await prisma.store.findMany({
      where: {
        defaultSalesman: {
          contains: 'busdev',
          mode: 'insensitive',
        }
      },
      select: {
        id: true,
        accurateId: true,
        name: true,
        code: true,
        defaultSalesman: true,
      },
      orderBy: { name: 'asc' },
    })

    // Map ke format yang sama dengan before agar frontend tidak perlu ubah
    const customers = stores.map(s => ({
      id: s.accurateId ?? s.id,  // pakai accurateId (= customerNo) sebagai value
      customerNo: s.code,
      name: s.name,
      defaultSalesman: s.defaultSalesman ? { name: s.defaultSalesman } : null,
    }))

    return NextResponse.json({ customers, total: customers.length, source: 'local_db' })
  } catch (err: any) {
    console.error('[bd-customers] error:', err)
    return NextResponse.json({ error: 'Gagal mengambil data customer BD: ' + (err.message ?? 'Unknown error') }, { status: 500 })
  }
}
