import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * Classification logic for Demo Plot (from DemoPlot model):
 *  - mini: 1–3 products
 *  - full: ≥4 products
 *
 * Spot Demo Plot is a SEPARATE model (SpotDemplot) and always type 'spot'.
 * It is NOT determined by product count in DemoPlot.
 */
function classifyDemoPlot(productCount: number): 'mini' | 'full' {
  if (productCount >= 4) return 'full'
  return 'mini'
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

    // Map DemoPlot records (mini / full)
    const demoPlotPoints = demoPlots
      .filter(dp => dp.latitude !== null && dp.longitude !== null)
      .map(dp => {
        // Count distinct products used in this session
        const products = dp.details.length > 0
          ? dp.details.map(d => d.product.name)
          : dp.request?.details?.map(d => d.product.name) ?? []

        const type = classifyDemoPlot(products.length)
        
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

    // Fetch Spot Demo Plots (separate model: SpotDemplot)
    // Apply the same dashboard filters (areaId, userId, start, end) as DemoPlot
    const spotWhere: any = {
      latitude: { not: null },
      longitude: { not: null },
    }

    // Apply areaId filter
    const qAreaId = searchParams.get('areaId')
    if (qAreaId) {
      spotWhere.snapshotAreaId = qAreaId
    }

    // Apply userId filter
    const qUserId = searchParams.get('userId')
    if (qUserId) {
      spotWhere.userId = qUserId
    }

    // Apply date range filters (start / end from dashboard)
    const qStart = searchParams.get('start')
    const qEnd = searchParams.get('end')
    if (qStart || qEnd) {
      spotWhere.date = {}
      if (qStart) spotWhere.date.gte = new Date(`${qStart}T00:00:00.000Z`)
      if (qEnd) spotWhere.date.lte = new Date(`${qEnd}T23:59:59.999Z`)
    }

    const spotDemoPlots = await prisma.spotDemplot.findMany({
      where: spotWhere,
      include: {
        user: { select: { name: true, area: { select: { name: true } } } },
        details: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const spotPoints = spotDemoPlots
      .filter(sp => sp.latitude !== null && sp.longitude !== null)
      .map(sp => {
        const products = sp.details.map(d => d.product.name)
        const mappedArea = sp.snapshotAreaId ? areaMap.get(sp.snapshotAreaId) : null
        const area = mappedArea ?? sp.user?.area?.name ?? '-'

        return {
          id: sp.id,
          lat: sp.latitude!,
          lng: sp.longitude!,
          farmerName: '-', // Spot demo plots don't have a farmer
          area,
          commodity: '-',
          foName: sp.user?.name ?? '-',
          date: sp.date.toISOString(),
          productCount: products.length,
          products,
          type: 'spot' as const,
        }
      })

    return NextResponse.json([...demoPlotPoints, ...spotPoints])
  } catch (err) {
    console.error('demoplot-map error', err)
    return NextResponse.json([])
  }
}
