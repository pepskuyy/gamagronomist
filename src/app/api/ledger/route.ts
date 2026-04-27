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
    const targetUserId = searchParams.get('userId') || ''

    let effectiveUserId = session.userId

    if (targetUserId && targetUserId !== session.userId) {
      if (session.role === 'AFA') {
        // Verify target is an FO in the same area
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
        if (!targetUser || targetUser.role !== 'FO' || targetUser.areaId !== session.areaId) {
          return NextResponse.json({ error: 'Unauthorized to view this user\'s ledger' }, { status: 403 })
        }
        effectiveUserId = targetUserId
      } else if (session.role === 'ADMIN' || session.role === 'SPV') {
        effectiveUserId = targetUserId
      } else {
        return NextResponse.json({ error: 'Unauthorized to view this user\'s ledger' }, { status: 403 })
      }
    }

    const where: any = { userId: effectiveUserId }
    if (type)    where.transactionType = type
    if (product) where.productId = product
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(`${to}T23:59:59.999Z`)
    }

    // Fetch filtered ledger rows (newest first)
    const ledgers = await prisma.ledger.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unit: true, unitGramasi: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    if (ledgers.length === 0) return NextResponse.json([])

    // For each unique productId in result, calculate cumulative stock AFTER each row
    // Strategy: for each product, get ALL ledger entries for that user ordered by createdAt ASC,
    // then compute running balance — this gives us stockBefore and stockAfter per transaction.

    const productIds = [...new Set(ledgers.map(l => l.productId))]

    // Fetch full ledger history per product (for running balance calculation)
    const allByProduct = await prisma.ledger.findMany({
      where: { userId: effectiveUserId, productId: { in: productIds } },
      select: { id: true, productId: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Build running balance map: ledgerId → { stockBefore, stockAfter }
    const balanceMap = new Map<string, { stockBefore: number; stockAfter: number }>()

    // Group by productId
    const grouped: Record<string, typeof allByProduct> = {}
    for (const row of allByProduct) {
      if (!grouped[row.productId]) grouped[row.productId] = []
      grouped[row.productId].push(row)
    }

    for (const rows of Object.values(grouped)) {
      let running = 0
      for (const row of rows) {
        const stockBefore = running
        running += row.quantity
        balanceMap.set(row.id, { stockBefore, stockAfter: running })
      }
    }

    // Attach balance info to filtered results
    const result = ledgers.map(l => ({
      ...l,
      stockBefore: balanceMap.get(l.id)?.stockBefore ?? null,
      stockAfter:  balanceMap.get(l.id)?.stockAfter  ?? null,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
