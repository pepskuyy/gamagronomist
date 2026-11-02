'use client'

import type { DemoImpactSummary } from '@/lib/demoplot-impact'
import { formatKm, HELP_SAMPLE_YIELD } from '@/lib/impact-tier'

interface Props {
  /** Ringkasan dari daftar demplot (sumber yang sama dengan tabel) */
  impact: DemoImpactSummary | null
  loading: boolean
  radiusKm: number
}

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export default function SampleYieldCard({ impact, loading, radiusKm }: Props) {
  const radiusLabel = formatKm(radiusKm)

  let body: React.ReactNode
  if (loading) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Menghitung…</div>
  } else if (!impact) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>- Analisa belum tersedia.</div>
  } else if (impact.store_count === 0) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Tidak ada toko di radius {radiusLabel}.</div>
  } else if (impact.product_yields.length === 0) {
    const reason: Record<string, string> = {
      farmer_product: 'Demplot ini memakai produk milik petani, bukan sampel dari stok, sehingga rasio sampel tidak dihitung.',
      no_usage: 'Belum ada pemakaian produk yang tercatat pada demplot ini.',
    }
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{reason[impact.sample_status] ?? 'Rasio sampel tidak dapat dihitung.'}</div>
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {impact.product_yields.map((y) => (
          <div key={y.product} style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>{y.product}</div>
            <div style={{ color: '#475569' }}>
              Sampel {nf.format(y.sample_qty)} {y.sample_unit} → terjual{' '}
              {y.parts.length === 0
                ? (y.label === '-' ? '-' : 'belum ada')
                : y.parts.map(p => `${nf.format(p.packs)} ${p.unit}${p.size ? ` (${p.size})` : ''}`).join(' + ')}
            </div>
            <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
              {y.label}
            </div>
          </div>
        ))}
      </div>
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
