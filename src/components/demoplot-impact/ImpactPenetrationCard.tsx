'use client'

import type { DemoImpactSummary } from '@/lib/demoplot-impact'
import { Info } from 'lucide-react'
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
          <span style={{ fontSize: '24px', fontWeight: 600, color: tier.text, whiteSpace: 'nowrap' }} className="num">
            {formatImpactPct(pct, impact.impact_pct_capped)}
          </span>
          <div
            role="progressbar"
            aria-label="Penetrasi dampak"
            aria-valuenow={pct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ flex: 1, height: '8px', background: 'var(--surface-3)', borderRadius: '9999px', overflow: 'hidden' }}
          >
            <div style={{ width: `${Math.min(100, pct ?? 0)}%`, height: '100%', background: tier.bar, borderRadius: '9999px' }} />
          </div>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
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
        padding: '0.75rem',
        marginBottom: '0.75rem',
        background: !loading && impact && impact.store_count > 0 ? tier.bg : 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          Penetrasi Dampak{' '}
          <span title={HELP_IMPACT_PCT(radiusLabel)} style={{ cursor: 'help', color: 'var(--text-light)', display: 'inline-flex' }}><Info size={14} strokeWidth={1.75} /></span>
        </span>
        {!loading && impact && impact.store_count > 0 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: tier.text }}>{tier.label}</span>
        )}
      </div>
      {body}
    </div>
  )
}
