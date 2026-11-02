import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/sample-stock?view=balance|ledger|owners[&userId=]
// ADMIN boleh melihat Gudang Sampel milik SPV lain lewat userId (hanya baca).
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'balance'
    const isAdmin = session.role === 'ADMIN'

    if (view === 'owners') {
      // Daftar pemilik Gudang Sampel yang bisa dipilih ADMIN: semua SPV aktif + siapa pun yang punya transaksi sampel
      if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      const withLedger = await prisma.sampleLedger.findMany({ distinct: ['userId'], select: { userId: true } })
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'SPV', isActive: true },
            { id: { in: withLedger.map(l => l.userId) } },
          ],
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ me: session.userId, owners: users })
    }

    const requestedUserId = searchParams.get('userId')
    const ownerId = isAdmin && requestedUserId ? requestedUserId : session.userId

    // Full ledger history
    const ledgers = await prisma.sampleLedger.findMany({
      where: { userId: ownerId },
      include: { product: { select: { id: true, name: true, code: true, accurateId: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (view === 'ledger') {
      // Return detailed history, newest first, with running balance
      const balanceMap = new Map<string, number>()
      const withBalance = ledgers.map(l => {
        const prev = balanceMap.get(l.productId) ?? 0
        const after = prev + l.quantity
        balanceMap.set(l.productId, after)
        return { ...l, stockBefore: prev, stockAfter: after }
      })
      // Return newest first
      return NextResponse.json(withBalance.reverse())
    }

    // Compute balance per product — always use packaging unit (unit), not gramasi
    const balanceMap = new Map<string, {
      productId: string; productName: string; sku: string | null; unit: string; balance: number
      unitGramasi: string | null; gramasiPerUnit: number | null
    }>()
    for (const l of ledgers) {
      const unit = l.product.unit
      const existing = balanceMap.get(l.productId)
      if (existing) {
        existing.balance += l.quantity
      } else {
        balanceMap.set(l.productId, {
          productId: l.productId,
          productName: l.product.name,
          // Kode SKU: kode produk (termasuk SMPL- untuk produk sampel), fallback ke no. barang Accurate
          sku: l.product.code || l.product.accurateId || null,
          unit,
          balance: l.quantity,
          unitGramasi: l.product.unitGramasi ?? null,
          gramasiPerUnit: (l.product as any).gramasiPerUnit ?? null,
        })
      }
    }

    return NextResponse.json(Array.from(balanceMap.values()))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
