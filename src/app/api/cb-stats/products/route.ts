import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Build role filter
    let whereClause: any = {}
    if (session.role === 'FO') {
      whereClause = { userId: session.userId }
    } else if (session.role === 'AFA') {
      // Find all FOs under this AFA
      const fos = await prisma.user.findMany({
        where: { afaId: session.userId },
        select: { id: true }
      })
      const foIds = fos.map(f => f.id)
      foIds.push(session.userId) // include AFA's own entries
      whereClause = { userId: { in: foIds } }
    }

    const cbs = await prisma.customerBehavior.findMany({
      where: whereClause,
      select: { usedProducts: true }
    })

    // Count preferred products
    const tally: Record<string, number> = {}
    for (const cb of cbs) {
      const raw = cb.usedProducts || 'Tidak diketahui'
      const parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const p of parts) {
        const key = p || 'Tidak diketahui'
        tally[key] = (tally[key] || 0) + 1
      }
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(tally)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ total, items: sorted })
  } catch (err) {
    console.error('cb-stats-products error', err)
    return NextResponse.json({ total: 0, items: [] })
  }
}
