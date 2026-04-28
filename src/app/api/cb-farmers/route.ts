import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

async function getSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  return await decrypt(sessionToken as string)
}

// Return unique farmers from CustomerBehavior records for demo plot dropdown
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) return NextResponse.json([])

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, areaId: true }
    })
    if (!currentUser) return NextResponse.json([])

    const whereClause: any = {}
    if (['AFA', 'PLANTATION', 'FO', 'INTERN'].includes(currentUser.role) && currentUser.areaId) {
      whereClause.user = { areaId: currentUser.areaId }
    }

    const records = await prisma.customerBehavior.findMany({
      where: whereClause,
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
    }).map((r: any) => {
      let location = ''
      if (r.address) {
        // extract first two parts (desa and kecamatan) from the comma separated address
        const parts = r.address.split(',').map((p: string) => p.trim()).filter(Boolean)
        location = parts.slice(0, 2).join(', ')
      } else if (r.district) {
        location = r.district
      }

      return { ...r, location }
    })

    return NextResponse.json(unique)
  } catch (e) {
    console.error(e)
    return NextResponse.json([])
  }
}
