import prisma from '@/lib/prisma'
import { getKabupatenFromCoords, normalizeKabupaten } from './geocode'


// In-memory cache of area coverage to avoid repeated DB hits in same request
let _coverageCache: { areaId: string; kabupatenName: string }[] | null = null
let _cacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 menit

async function getAreaCoverage() {
  const now = Date.now()
  if (_coverageCache && now - _cacheTime < CACHE_TTL_MS) return _coverageCache
  _coverageCache = await prisma.areaCoverage.findMany({
    select: { areaId: true, kabupatenName: true }
  })
  _cacheTime = now
  return _coverageCache
}

/** Bersihkan cache (dipanggil setelah admin update coverage) */
export function invalidateAreaCoverageCache() {
  _coverageCache = null
}

/**
 * Resolve area dari koordinat GPS.
 * Priority: GPS (kabupaten mapping) → fallback: null (caller gunakan user.areaId)
 * Returns: areaId string | null
 */
export async function resolveAreaIdFromCoords(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const kabupatenRaw = await getKabupatenFromCoords(lat, lng)
    if (!kabupatenRaw) return null

    const coverage = await getAreaCoverage()
    if (!coverage.length) return null

    const kabNorm = normalizeKabupaten(kabupatenRaw)

    // Exact match dulu
    const exactMatch = coverage.find(c => c.kabupatenName === kabupatenRaw)
    if (exactMatch) return exactMatch.areaId

    // Normalized match (tanpa prefix kabupaten/kota)
    const normalizedMatch = coverage.find(c =>
      normalizeKabupaten(c.kabupatenName) === kabNorm
    )
    if (normalizedMatch) return normalizedMatch.areaId

    // Partial match (kabupaten yang panjang kadang ada versi pendek)
    const partialMatch = coverage.find(c =>
      kabNorm.includes(normalizeKabupaten(c.kabupatenName)) ||
      normalizeKabupaten(c.kabupatenName).includes(kabNorm)
    )
    if (partialMatch) return partialMatch.areaId

    return null
  } catch {
    return null
  }
}
