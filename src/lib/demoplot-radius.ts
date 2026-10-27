import prisma from '@/lib/prisma'

/**
 * Radius coverage default untuk analisa dampak demplot (toko di sekitar titik demplot).
 * Disimpan di SystemConfig (key `demoplot_radius_km`, value JSON) dan terpisah dari Sales Dashboard.
 */

export const RADIUS_CONFIG_KEY = 'demoplot_radius_km'
export const DEFAULT_RADIUS_KM = 2.5
export const MIN_RADIUS_KM = 0.5
export const MAX_RADIUS_KM = 20
export const RADIUS_EDIT_ROLES = ['ADMIN', 'SPV']

const CACHE_TTL_MS = 30_000

export interface RadiusSetting {
  radius_km: number
  updated_at: string | null
  updated_by: string | null
}

let cache: { value: RadiusSetting; expires: number } | null = null

/** Terima "3,5" maupun "3.5"; bulatkan 2 desimal. Mengembalikan null bila di luar 0,5–20 atau bukan angka. */
export function parseRadius(input: unknown): number | null {
  const raw = typeof input === 'number' ? input : Number(String(input ?? '').trim().replace(',', '.'))
  if (!Number.isFinite(raw)) return null
  const rounded = Math.round(raw * 100) / 100
  if (rounded < MIN_RADIUS_KM || rounded > MAX_RADIUS_KM) return null
  return rounded
}

export async function getRadiusSetting(): Promise<RadiusSetting> {
  if (cache && cache.expires > Date.now()) return cache.value

  let value: RadiusSetting = { radius_km: DEFAULT_RADIUS_KM, updated_at: null, updated_by: null }
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: RADIUS_CONFIG_KEY } })
    if (row) {
      const parsed = JSON.parse(row.value) as { radius_km?: unknown; updated_by?: string | null }
      value = {
        radius_km: parseRadius(parsed.radius_km) ?? DEFAULT_RADIUS_KM,
        updated_at: row.updatedAt.toISOString(),
        updated_by: parsed.updated_by ?? null,
      }
    }
  } catch (err) {
    console.warn('[demoplot-radius] Gagal membaca pengaturan radius, pakai default:', err)
  }

  cache = { value, expires: Date.now() + CACHE_TTL_MS }
  return value
}

export async function getDefaultRadiusKm(): Promise<number> {
  return (await getRadiusSetting()).radius_km
}

export async function saveRadiusSetting(radiusKm: number, updatedBy: string | null): Promise<RadiusSetting> {
  const value = JSON.stringify({ radius_km: radiusKm, updated_by: updatedBy })
  await prisma.systemConfig.upsert({
    where: { key: RADIUS_CONFIG_KEY },
    update: { value },
    create: { key: RADIUS_CONFIG_KEY, value, label: 'Radius coverage default demplot (km)' },
  })
  cache = null
  return getRadiusSetting()
}
