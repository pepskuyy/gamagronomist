import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

function classify(productCount: number): 'spot' | 'mini' | 'full' {
  if (productCount === 1) return 'spot'
  if (productCount <= 3) return 'mini'
  return 'full'
}

export async function GET(req: any) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Import helper
    const { buildDemoPlotWhereClause } = await import('@/lib/kpi-filters')
    const searchParams = req.nextUrl.searchParams
    const whereClause = await buildDemoPlotWhereClause(session, searchParams)

    // Ensure GPS coordinates exist
    whereClause.latitude = { not: null }
    whereClause.longitude = { not: null }

    // Fetch demo plots that have GPS coordinates
    const demoPlots = await prisma.demoPlot.findMany({
      where: whereClause,
      include: {
        farmer: true,
        request: {
          include: {
            fo: { select: { name: true, area: { select: { name: true } } } },
            details: { include: { product: { select: { name: true } } } }
          }
        },
        details: { include: { product: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Manual map for snapshotAreaId to area name (fallbacks)
    const allAreas = await prisma.area.findMany()
    const areaMap = new Map(allAreas.map(a => [a.id, a.name]))

    const result = demoPlots
      .filter(dp => dp.latitude !== null && dp.longitude !== null)
      .map(dp => {
        // Count distinct products used in this session
        const products = dp.details.length > 0
          ? dp.details.map(d => d.product.name)
          : dp.request?.details?.map(d => d.product.name) ?? []

        const type = classify(products.length)
        
        // Priority for Area: snapshotAreaId -> FO's current area -> recorded area
        const mappedSnapshotArea = dp.snapshotAreaId ? areaMap.get(dp.snapshotAreaId) : null
        const internalArea = mappedSnapshotArea ?? dp.request?.fo?.area?.name ?? dp.area ?? '-'

        return {
          id: dp.id,
          lat: dp.latitude!,
          lng: dp.longitude!,
          farmerName: dp.farmer?.name ?? 'Tidak diketahui',
          area: internalArea,
          commodity: dp.commodity ?? dp.request?.commodity ?? '-',
          foName: dp.request?.fo?.name ?? '-',
          date: dp.date.toISOString(),
          productCount: products.length,
          products,
          type,
        }
      })

    return NextResponse.json(result)
  } catch (err) {
    console.error('demoplot-map error', err)
    return NextResponse.json([])
  }
}
