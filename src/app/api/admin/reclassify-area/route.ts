import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getKabupatenFromCoords, normalizeKabupaten } from '@/lib/geocode'
import { invalidateAreaCoverageCache } from '@/lib/area-resolver'

const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Reclassify GPS-tagged records based on area coverage mapping.
 * 
 * Params:
 *   secret   = gamagronomist-reclassify-2025
 *   table    = demoPlot | spotDemplot | customerBehavior (default: demoPlot)
 *   batch    = number of records per call (default: 5, max ~8 safe for 10s timeout)
 *   offset   = skip first N records (for pagination)
 *   dryRun   = true → log only, don't update
 * 
 * Example flow:
 *   /api/admin/reclassify-area?secret=...&table=demoPlot&batch=5&offset=0
 *   /api/admin/reclassify-area?secret=...&table=demoPlot&batch=5&offset=5
 *   ... until nextOffset >= total
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret   = url.searchParams.get('secret')
  const table    = (url.searchParams.get('table') || 'demoPlot') as 'demoPlot' | 'spotDemplot' | 'customerBehavior'
  const batch    = Math.min(parseInt(url.searchParams.get('batch') || '5'), 8)
  const offset   = parseInt(url.searchParams.get('offset') || '0')
  const dryRun   = url.searchParams.get('dryRun') === 'true'

  if (secret !== 'gamagronomist-reclassify-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['demoPlot', 'spotDemplot', 'customerBehavior'].includes(table)) {
    return NextResponse.json({ error: 'table harus: demoPlot | spotDemplot | customerBehavior' }, { status: 400 })
  }

  // Load coverages
  const coverages = await prisma.areaCoverage.findMany()
  if (!coverages.length) {
    return NextResponse.json({ error: 'Tidak ada area coverage. Tambahkan di Master Data → Area.' }, { status: 400 })
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

  // Fetch only the batch + count total
  type Row = { id: string; latitude: number | null; longitude: number | null }
  let records: Row[] = []
  let total = 0

  if (table === 'demoPlot') {
    const [rows, count] = await Promise.all([
      prisma.demoPlot.findMany({ select: { id: true, latitude: true, longitude: true }, skip: offset, take: batch }),
      prisma.demoPlot.count(),
    ])
    records = rows; total = count
  } else if (table === 'spotDemplot') {
    const [rows, count] = await Promise.all([
      prisma.spotDemplot.findMany({ select: { id: true, latitude: true, longitude: true }, skip: offset, take: batch }),
      prisma.spotDemplot.count(),
    ])
    records = rows; total = count
  } else {
    const [rows, count] = await Promise.all([
      prisma.customerBehavior.findMany({ select: { id: true, latitude: true, longitude: true }, skip: offset, take: batch }),
      prisma.customerBehavior.count(),
    ])
    records = rows; total = count
  }

  const results: { id: string; kabupaten: string | null; areaId: string | null; action: string }[] = []

  for (const r of records) {
    if (!r.latitude || !r.longitude) {
      results.push({ id: r.id, kabupaten: null, areaId: null, action: 'skipped_no_gps' })
      continue
    }
    await sleep(1100) // Nominatim 1 req/s
    const kabRaw = await getKabupatenFromCoords(r.latitude, r.longitude)
    const areaId = kabRaw ? matchArea(kabRaw) : null

    if (!areaId) {
      results.push({ id: r.id, kabupaten: kabRaw, areaId: null, action: 'not_matched' })
      continue
    }

    if (!dryRun) {
      if (table === 'demoPlot') await prisma.demoPlot.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
      else if (table === 'spotDemplot') await prisma.spotDemplot.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
      else await prisma.customerBehavior.update({ where: { id: r.id }, data: { snapshotAreaId: areaId } })
    }

    results.push({ id: r.id, kabupaten: kabRaw, areaId, action: dryRun ? 'dry_run' : 'updated' })
  }

  invalidateAreaCoverageCache()

  const nextOffset = offset + batch
  const isDone = nextOffset >= total

  return NextResponse.json({
    success: true,
    table,
    dryRun,
    offset,
    batch,
    total,
    processed: records.length,
    nextOffset: isDone ? null : nextOffset,
    done: isDone,
    nextUrl: isDone ? null : `/api/admin/reclassify-area?secret=gamagronomist-reclassify-2025&table=${table}&batch=${batch}&offset=${nextOffset}${dryRun ? '&dryRun=true' : ''}`,
    results,
  })
}
