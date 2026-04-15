import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ONE-TIME USE: Backfill snapshotAreaId from user.areaId for all existing records
// DELETE THIS FILE after use!
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== 'gamagronomist-backfill-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, number> = {}

  try {
    // 1. Request: fill from fo (requester) user's areaId
    const requests = await prisma.request.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, foId: true, fo: { select: { areaId: true } } }
    })
    for (const r of requests) {
      if (r.fo?.areaId) {
        await prisma.request.update({ where: { id: r.id }, data: { snapshotAreaId: r.fo.areaId } })
      }
    }
    results.request = requests.length

    // 2. DemoPlot: fill from request's snapshotAreaId
    const demoPlots = await prisma.demoPlot.findMany({
      where: { snapshotAreaId: null, requestId: { not: null } },
      select: { id: true, requestId: true, request: { select: { snapshotAreaId: true } } }
    })
    for (const d of demoPlots) {
      if (d.request?.snapshotAreaId) {
        await prisma.demoPlot.update({ where: { id: d.id }, data: { snapshotAreaId: d.request.snapshotAreaId } })
      }
    }
    results.demoPlot = demoPlots.length

    // 3. SpotDemplot: fill from user.areaId
    const spots = await prisma.spotDemplot.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const s of spots) {
      if (s.user?.areaId) {
        await prisma.spotDemplot.update({ where: { id: s.id }, data: { snapshotAreaId: s.user.areaId } })
      }
    }
    results.spotDemplot = spots.length

    // 4. CustomerBehavior
    const cbs = await prisma.customerBehavior.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const c of cbs) {
      if (c.user?.areaId) {
        await prisma.customerBehavior.update({ where: { id: c.id }, data: { snapshotAreaId: c.user.areaId } })
      }
    }
    results.customerBehavior = cbs.length

    // 5. VisitKios
    const kios = await prisma.visitKios.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const k of kios) {
      if (k.user?.areaId) {
        await prisma.visitKios.update({ where: { id: k.id }, data: { snapshotAreaId: k.user.areaId } })
      }
    }
    results.visitKios = kios.length

    // 6. FarmerGathering
    const gatherings = await prisma.farmerGathering.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const g of gatherings) {
      if (g.user?.areaId) {
        await prisma.farmerGathering.update({ where: { id: g.id }, data: { snapshotAreaId: g.user.areaId } })
      }
    }
    results.farmerGathering = gatherings.length

    // 7. VisitCompany
    const companies = await prisma.visitCompany.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const v of companies) {
      if (v.user?.areaId) {
        await prisma.visitCompany.update({ where: { id: v.id }, data: { snapshotAreaId: v.user.areaId } })
      }
    }
    results.visitCompany = companies.length

    // 8. Ledger: fill from user.areaId
    const ledgers = await prisma.ledger.findMany({
      where: { snapshotAreaId: null },
      select: { id: true, userId: true, user: { select: { areaId: true } } }
    })
    for (const l of ledgers) {
      if (l.user?.areaId) {
        await prisma.ledger.update({ where: { id: l.id }, data: { snapshotAreaId: l.user.areaId } })
      }
    }
    results.ledger = ledgers.length

    return NextResponse.json({ success: true, backfilled: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
