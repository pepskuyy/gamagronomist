import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/sample-stock?view=balance|ledger
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId || !['SPV', 'ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'balance'

    // Full ledger history
    const ledgers = await prisma.sampleLedger.findMany({
      where: { userId: session.userId },
      include: { product: { select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } },
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
      productId: string; productName: string; unit: string; balance: number
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
          unit,
          balance: l.quantity,
          unitGramasi: l.product.unitGramasi ?? null,
          gramasiPerUnit: (l.product as any).gramasiPerUnit ?? null,
        })
      }
    }
    const finalBalances = Array.from(balanceMap.values()).filter(item => item.balance > 0)
    return NextResponse.json(finalBalances)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
