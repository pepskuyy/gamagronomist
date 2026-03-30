import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * Returns the AFA supervisor's current stock with positive balances.
 * Used by FOs so they can only request products their AFA actually has.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await decrypt(sessionToken)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Determine AFA userId: if caller is FO/INTERN, use their afaId; if AFA, use their own id
    let afaUserId: string | null = null
    if (session.role === 'FO' || session.role === 'INTERN') {
      afaUserId = session.afaId || null
    } else if (session.role === 'AFA') {
      afaUserId = session.userId
    }

    if (!afaUserId) {
      return NextResponse.json([]) // No AFA assigned
    }

    // Calculate AFA's stock balance per product from ledger
    const ledgers = await prisma.ledger.groupBy({
      by: ['productId'],
      where: { userId: afaUserId },
      _sum: { quantity: true },
    })

    // Only include products with positive balance
    const positiveProducts = ledgers.filter(l => (l._sum.quantity || 0) > 0)

    if (positiveProducts.length === 0) {
      return NextResponse.json([])
    }

    // Fetch product details for matching products
    const productIds = positiveProducts.map(l => l.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true },
      orderBy: { name: 'asc' },
    })

    // Merge balance info into the product data
    const result = products.map(p => {
      const ledger = positiveProducts.find(l => l.productId === p.id)
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        balance: ledger?._sum.quantity || 0,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('afa-stock API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
