import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

/** Normalize a product name for grouping purposes:
 *  1. Trim whitespace
 *  2. Strip common prefixes (e.g. "Produk ", "produk ")
 *  3. Lowercase for grouping key
 */
function normalizeKey(raw: string): string {
  return raw
    .trim()
    .replace(/^produk\s+/i, '') // remove leading "Produk " prefix (case-insensitive)
    .toLowerCase()
}

/** Produce a display-friendly name (Title Case) from a raw entry */
function toDisplayName(raw: string): string {
  return raw
    .trim()
    .replace(/^produk\s+/i, '') // remove "Produk " prefix
    .replace(/\b\w/g, c => c.toUpperCase()) // Title Case
}

export async function GET(req: any) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Import helper
    const { buildActivityWhereClause } = await import('@/lib/kpi-filters')
    const searchParams = req.nextUrl.searchParams
    const whereClause = await buildActivityWhereClause(session, searchParams)

    const cbs = await prisma.customerBehavior.findMany({
      where: whereClause,
      select: { usedProducts: true }
    })

    // Count preferred products with normalization
    const tally: Record<string, number> = {}    // key = normalized lowercase
    const nameMap: Record<string, string> = {}  // key → display name

    for (const cb of cbs) {
      const raw = cb.usedProducts || 'Tidak diketahui'
      const parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const p of parts) {
        const entry = p || 'Tidak diketahui'
        const key = normalizeKey(entry)
        if (!key) continue
        tally[key] = (tally[key] || 0) + 1
        // Keep the first encountered display name for this key
        if (!nameMap[key]) nameMap[key] = toDisplayName(entry)
      }
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(tally)
      .map(([key, count]) => ({
        name: nameMap[key] || key,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ total, items: sorted })
  } catch (err) {
    console.error('cb-stats-products error', err)
    return NextResponse.json({ total: 0, items: [] })
  }
}

