import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

// Return unique farmers from CustomerBehavior records for demo plot dropdown
export async function GET() {
  try {
    const records = await (prisma as any).customerBehavior.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        farmerName: true,
        phone: true,
        district: true,
        address: true,
        commodity: true,
        constraints: true,
      },
    })

    // Deduplicate by farmerName (keep latest)
    const seen = new Set<string>()
    const unique = records.filter((r: any) => {
      const key = r.farmerName?.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json(unique)
  } catch {
    return NextResponse.json([])
  }
}
