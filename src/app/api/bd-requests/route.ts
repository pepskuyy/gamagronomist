import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bd-requests
 * Mengambil riwayat pengajuan stok milik user BD yang sedang login
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)

    if (!session?.userId || session.role !== 'BD') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const requests = await prisma.request.findMany({
      where: {
        foId: session.userId,
        commodity: 'AFA_STOCK_IN',
      },
      select: {
        id:              true,
        createdAt:       true,
        status:          true,
        plan:            true,
        warehouseSource: true,
        details: {
          include: {
            product: { select: { name: true } }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })


    return NextResponse.json(requests)
  } catch (e) {
    console.error('[bd-requests]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
