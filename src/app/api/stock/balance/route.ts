import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!session?.userId) return NextResponse.json([])

    const ledgers = await prisma.ledger.groupBy({
      by: ['productId'],
      where: { userId: session.userId },
      _sum: { quantity: true },
    })

    const result = ledgers
      .map(l => ({ productId: l.productId, quantity: l._sum.quantity || 0 }))
      .filter(l => l.quantity > 0)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([])
  }
}
