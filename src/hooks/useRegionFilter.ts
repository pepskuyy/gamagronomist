/**
 * Filter titik (lat/lng) berdasarkan polygon wilayah GeoJSON.
 * Memakai bbox prefilter lalu ray-casting — tanpa dependency tambahan.
 */

export type LatLngPoint = { lat: number; lng: number }

export type BBox = [number, number, number, number] // [minLng, minLat, maxLng, maxLat]

export function bboxOfGeometry(geometry: any): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const walk = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      return
    }
    for (const c of coords) walk(c)
  }

  if (!geometry?.coordinates) return null
  walk(geometry.coordinates)
  if (!Number.isFinite(minX)) return null
  return [minX, minY, maxX, maxY]
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function pointInPolygon(lng: number, lat: number, rings: number[][][]): boolean {
  // Ring pertama = luar, sisanya = lubang
  if (!pointInRing(lng, lat, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false
  }
  return true
}

export function pointInGeometry(lng: number, lat: number, geometry: any): boolean {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lng, lat, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly: number[][][]) => pointInPolygon(lng, lat, poly))
  }
  return false
}

/**
 * Saring titik yang berada di dalam polygon.
 * bbox dipakai lebih dulu agar titik di luar bounding box cepat tersaring.
 */
export function filterPointsInGeometry<T extends LatLngPoint>(
  points: T[],
  geometry: any
): T[] {
  if (!geometry) return points

  const bbox = bboxOfGeometry(geometry)
  if (!bbox) return points
  const [minX, minY, maxX, maxY] = bbox

  return points.filter((p) => {
    if (p.lng < minX || p.lng > maxX || p.lat < minY || p.lat > maxY) return false
    return pointInGeometry(p.lng, p.lat, geometry)
  })
}
