'use client'

import type { DemoImpactSummary } from '@/lib/demoplot-impact'
import { getImpactTier, formatImpactPct, formatKm, HELP_IMPACT_PCT } from '@/lib/impact-tier'

interface Props {
  impact: DemoImpactSummary | null
  loading: boolean
  radiusKm: number
}

export default function ImpactPenetrationCard({ impact, loading, radiusKm }: Props) {
  const radiusLabel = formatKm(radiusKm)
  const tier = getImpactTier(impact?.impact_pct)
  const pct = impact?.impact_pct ?? null

  let body: React.ReactNode
  if (loading) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Menghitung…</div>
  } else if (!impact) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>- Analisa dampak belum tersedia.</div>
  } else if (impact.store_count === 0) {
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Tidak ada toko di radius {radiusLabel}.</div>
  } else {
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tier.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {formatImpactPct(pct, impact.impact_pct_capped)}
          </span>
          <div
            role="progressbar"
            aria-label="Penetrasi dampak"
            aria-valuenow={pct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}
          >
            <div style={{ width: `${Math.min(100, pct ?? 0)}%`, height: '100%', background: tier.bar, borderRadius: '9999px' }} />
          </div>
        </div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
          {impact.impacted_store_count} dari {impact.store_count} toko di radius {radiusLabel} membeli produk demplot (60 hari setelah demplot)
        </div>
        {impact.impact_pct_capped && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            ≥ karena analisa dibatasi {impact.analyzed_store_count} toko terdekat.
          </div>
        )}
      </>
    )
  }

  return (
    <div
      style={{
        padding: '0.85rem',
        marginBottom: '0.75rem',
        background: !loading && impact && impact.store_count > 0 ? tier.bg : '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
          Penetrasi Dampak{' '}
          <span title={HELP_IMPACT_PCT(radiusLabel)} style={{ cursor: 'help', color: '#94a3b8' }}>ⓘ</span>
        </span>
        {!loading && impact && impact.store_count > 0 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: tier.text }}>{tier.label}</span>
        )}
      </div>
      {body}
    </div>
  )
}
