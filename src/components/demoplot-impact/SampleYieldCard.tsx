'use client'

import type { DemoImpactSummary, ProductImpactResult } from '@/lib/demoplot-impact'
import { formatKm, formatPcsPerLiter, formatLiterKg, HELP_SAMPLE_YIELD } from '@/lib/impact-tier'

interface Props {
  /** Ringkasan dari daftar demplot (sumber yang sama dengan tabel) */
  impact: DemoImpactSummary | null
  loading: boolean
  radiusKm: number
  /** Rincian per produk dari detail demplot */
  products: ProductImpactResult[]
}

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export default function SampleYieldCard({ impact, loading, radiusKm, products }: Props) {
  const radiusLabel = formatKm(radiusKm)
  const sampled = products.filter(p => p.sample_qty > 0)

  let body: React.ReactNode
  if (loading) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Menghitung…</div>
  } else if (!impact) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>- Analisa belum tersedia.</div>
  } else if (impact.store_count === 0) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Tidak ada toko di radius {radiusLabel}.</div>
  } else if (impact.sample_liter_kg === null) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sampel tidak tercatat dalam ml/gr, rasio tidak dapat dihitung.</div>
  } else {
    body = (
      <>
        <div style={{ fontSize: '24px', fontWeight: 800, color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}>
          {formatPcsPerLiter(impact.pcs_per_liter_kg)}
        </div>
        <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
          {formatLiterKg(impact.sample_liter_kg)} sampel → {nf.format(Math.max(0, impact.sold_after_qty_sampled))} PCS terjual dalam 60 hari sesudah demplot
        </div>
        {sampled.length > 0 && (
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {sampled.map(p => (
              <div key={p.product_name} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: '#334155', minWidth: 0, overflowWrap: 'anywhere' }}>
                  {p.product_name} · {nf.format(p.sample_qty)} {p.sample_unit} → {nf.format(Math.max(0, p.after_qty))} PCS
                </span>
                <span style={{ fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                  {p.pcs_per_liter_kg === null ? '-' : `${nf.format(p.pcs_per_liter_kg)}/L·kg`}
                </span>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '0.85rem', marginBottom: '0.75rem', background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '0.65rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
        Rasio Sampel → Penjualan{' '}
        <span title={HELP_SAMPLE_YIELD(radiusLabel)} style={{ cursor: 'help', color: '#94a3b8' }}>ⓘ</span>
      </div>
      {body}
    </div>
  )
}
