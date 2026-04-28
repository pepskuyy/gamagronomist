import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

/**
 * GET /api/sample-stock-for-afa
 * Returns aggregated sample stock balances of the SPV(s) in the same area as the requesting AFA.
 * Used on the AFA stock request form to show only products that are actually available in the sample warehouse.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!session?.userId || !['AFA', 'PLANTATION', 'FO', 'INTERN'].includes(session.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 1. Find the AFA's area
    const afaUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { areaId: true }
    })

    // 2. Find SPV(s) in the same area (including global SPVs with areaId = null)
    const spvWhere: any = { role: 'SPV', isActive: true }
    if (afaUser?.areaId) {
      spvWhere.OR = [
        { areaId: afaUser.areaId },
        { areaId: null }
      ]
    }
    const spvs = await prisma.user.findMany({ where: spvWhere, select: { id: true } })
    const spvIds = spvs.map(s => s.id)

    if (spvIds.length === 0) {
      return NextResponse.json([])
    }

    // 3. Aggregate sample ledger balances per product from all relevant SPVs
    const ledgers = await prisma.sampleLedger.findMany({
      where: { userId: { in: spvIds } },
      include: { product: { select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } },
    })

    const balanceMap = new Map<string, {
      productId: string
      productName: string
      unit: string
      unitGramasi: string | null
      gramasiPerUnit: number | null
      balance: number
    }>()

    for (const l of ledgers) {
      const existing = balanceMap.get(l.productId)
      if (existing) {
        existing.balance += l.quantity
      } else {
        balanceMap.set(l.productId, {
          productId: l.productId,
          productName: l.product.name,
          unit: l.product.unit,
          unitGramasi: l.product.unitGramasi ?? null,
          gramasiPerUnit: l.product.gramasiPerUnit ?? null,
          balance: l.quantity,
        })
      }
    }

    // 4. Return only products with positive balance
    const result = Array.from(balanceMap.values()).filter(p => p.balance > 0)

    return NextResponse.json(result)
  } catch (e) {
    console.error('[sample-stock-for-afa]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
