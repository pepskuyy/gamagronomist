import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getKabupatenFromCoords } from '@/lib/geocode'
import { normalizeKabupaten } from '@/lib/geocode'
import { invalidateAreaCoverageCache } from '@/lib/area-resolver'

const prisma = new PrismaClient()

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ONE-TIME USE: Reclassify existing GPS-tagged records based on area coverage mapping
export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  const limitParam = url.searchParams.get('limit')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  if (secret !== 'gamagronomist-reclassify-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limit = limitParam ? parseInt(limitParam) : 999999

  // Load all area coverages
  const coverages = await prisma.areaCoverage.findMany()
  if (!coverages.length) {
    return NextResponse.json({ error: 'Tidak ada area coverage yang dikonfigurasi. Tambahkan dulu di Master Data → Area.' })
  }

  function matchArea(kabRaw: string): string | null {
    const kabNorm = normalizeKabupaten(kabRaw)
    const exact = coverages.find(c => c.kabupatenName === kabRaw.toLowerCase().trim())
    if (exact) return exact.areaId
    const norm = coverages.find(c => normalizeKabupaten(c.kabupatenName) === kabNorm)
    if (norm) return norm.areaId
    const partial = coverages.find(c =>
      kabNorm.includes(normalizeKabupaten(c.kabupatenName)) ||
      normalizeKabupaten(c.kabupatenName).includes(kabNorm)
    )
    return partial?.areaId ?? null
  }

  const stats = {
    demoPlot:        { processed: 0, updated: 0, notFound: 0, noGps: 0 },
    spotDemplot:     { processed: 0, updated: 0, notFound: 0, noGps: 0 },
    customerBehavior:{ processed: 0, updated: 0, notFound: 0, noGps: 0 },
  }

  // Helper to process a table
  async function processTable(
    table: 'demoPlot' | 'spotDemplot' | 'customerBehavior',
    records: { id: string; latitude: number | null; longitude: number | null }[]
  ) {
    let count = 0
    for (const r of records) {
      if (count >= limit) break
      stats[table].processed++
      count++
      if (!r.latitude || !r.longitude) { stats[table].noGps++; continue }
      await sleep(1100) // Respect Nominatim 1 req/s rate limit
      const kabRaw = await getKabupatenFromCoords(r.latitude, r.longitude)
      if (!kabRaw) { stats[table].notFound++; continue }
      const areaId = matchArea(kabRaw)
      if (!areaId) { stats[table].notFound++; continue }
      if (!dryRun) {
        if (table === 'demoPlot') {
          await prisma.demoPlot.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
        } else if (table === 'spotDemplot') {
          await prisma.spotDemplot.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
        } else {
          await prisma.customerBehavior.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
        }
      }
      stats[table].updated++
    }
  }

  const [demoPlots, spots, cbs] = await Promise.all([
    prisma.demoPlot.findMany({ select: { id: true, latitude: true, longitude: true } }),
    prisma.spotDemplot.findMany({ select: { id: true, latitude: true, longitude: true } }),
    prisma.customerBehavior.findMany({ select: { id: true, latitude: true, longitude: true } }),
  ])

  await processTable('demoPlot', demoPlots.slice(0, limit))
  await processTable('spotDemplot', spots.slice(0, limit))
  await processTable('customerBehavior', cbs.slice(0, limit))

  invalidateAreaCoverageCache()
  return NextResponse.json({ success: true, dryRun, stats })
}
