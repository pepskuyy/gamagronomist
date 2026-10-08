import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


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

    // Group DemoPlot records by requestId so each Demo Plot shows only 1 point (latest session)
    // with accumulated products from all sessions
    type DemoPlotGroup = {
      latestSession: (typeof demoPlots)[0]
      sessionCount: number
      productNames: Set<string>
      isCompleted: boolean
    }

    const groupMap = new Map<string, DemoPlotGroup>()

    for (const dp of demoPlots) {
      if (dp.latitude === null || dp.longitude === null) continue

      const groupKey = dp.requestId ? `req_${dp.requestId}` : `dp_${dp.id}`
      const existing = groupMap.get(groupKey)

      // Collect products from this session (or fallback to request details)
      const sessionProducts = dp.details.length > 0
        ? (dp.details.map(d => d.product?.name).filter(Boolean) as string[])
        : (dp.request?.details?.map(d => d.product?.name).filter(Boolean) as string[] ?? [])

      const isFinal = Boolean(dp.isFinalSession || dp.request?.status === 'DEMO_PLOT_SELESAI')

      if (!existing) {
        // Since demoPlots is ordered by createdAt desc, the first record is the latest session
        const productSet = new Set<string>(sessionProducts)
        groupMap.set(groupKey, {
          latestSession: dp,
          sessionCount: 1,
          productNames: productSet,
          isCompleted: isFinal,
        })
      } else {
        existing.sessionCount += 1
        sessionProducts.forEach(p => existing.productNames.add(p))
        if (isFinal) {
          existing.isCompleted = true
        }
      }
    }

    // Map grouped DemoPlot records (mini / full)
    const demoPlotPoints = Array.from(groupMap.values()).map(group => {
      const dp = group.latestSession
      const products = Array.from(group.productNames)
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
        sessionCount: group.sessionCount,
        isCompleted: group.isCompleted,
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
          sessionCount: 1,
          isCompleted: true,
        }
      })

    return NextResponse.json([...demoPlotPoints, ...spotPoints])
  } catch (err) {
    console.error('demoplot-map error', err)
    return NextResponse.json([])
  }
}
