/**
 * Tier warna "Penetrasi Dampak" (% toko terdampak di radius). Aman dipakai di client.
 * Ambang dan warna sama dengan Sales Dashboard.
 */

export type ImpactTierKey = 'strong' | 'medium' | 'low' | 'none'

export interface ImpactTier {
  key: ImpactTierKey
  label: string
  text: string
  bg: string
  bar: string
}

export const IMPACT_TIERS: Record<ImpactTierKey, ImpactTier> = {
  strong: { key: 'strong', label: 'Kuat', text: '#15803d', bg: '#f0fdf4', bar: '#16a34a' },
  medium: { key: 'medium', label: 'Sedang', text: '#b45309', bg: '#fffbeb', bar: '#d97706' },
  low: { key: 'low', label: 'Rendah', text: '#64748b', bg: '#f8fafc', bar: '#94a3b8' },
  none: { key: 'none', label: '-', text: 'var(--text-muted)', bg: 'transparent', bar: '#cbd5e1' },
}

export function getImpactTier(pct: number | null | undefined): ImpactTier {
  if (pct === null || pct === undefined) return IMPACT_TIERS.none
  if (pct >= 30) return IMPACT_TIERS.strong
  if (pct >= 10) return IMPACT_TIERS.medium
  return IMPACT_TIERS.low
}

const pctFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

/** "12,5%", "≥ 23%" bila capped, "-" bila null. */
export function formatImpactPct(pct: number | null | undefined, capped = false): string {
  if (pct === null || pct === undefined) return '-'
  return `${capped ? '≥ ' : ''}${pctFormat.format(pct)}%`
}

/** "2,5 km" */
export function formatKm(km: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(km)} km`
}

export const RADIUS_PRESETS = [1, 2.5, 5]

export const HELP_IMPACT_PCT = (radiusLabel: string) =>
  `Toko terdampak ÷ seluruh toko pelanggan ber-GPS di radius ${radiusLabel}. Hijau ≥30% (kuat), kuning 10–29% (sedang), abu <10% (rendah). ` +
  'Membandingkan demplot secara adil: 3 dari 10 toko (30%) lebih kuat daripada 5 dari 60 toko (8%). ' +
  'Tanda ≥ berarti analisa dibatasi toko terdekat sehingga angka sebenarnya bisa lebih tinggi.'

export const HELP_RADIUS = (radiusLabel: string) =>
  `Toko dianggap berada di sekitar kegiatan bila jarak lurusnya ≤ ${radiusLabel} dari titik GPS demplot. ` +
  'Default ini bisa diubah admin; pilihan di atas peta hanya mengubah tampilan sementara.'
