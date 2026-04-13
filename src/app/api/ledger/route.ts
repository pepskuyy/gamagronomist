'use server'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type    = searchParams.get('type') || ''
    const from    = searchParams.get('from') || ''
    const to      = searchParams.get('to') || ''
    const product = searchParams.get('product') || ''

    const where: any = { userId: session.userId }
    if (type)    where.transactionType = type
    if (product) where.productId = product
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(`${to}T23:59:59.999Z`)
    }

    const ledgers = await prisma.ledger.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unit: true, unitGramasi: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Generous limit for export
    })

    return NextResponse.json(ledgers)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
