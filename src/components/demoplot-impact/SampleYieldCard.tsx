'use client'

import type { DemoImpactSummary } from '@/lib/demoplot-impact'
import { Info } from 'lucide-react'
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {impact.product_yields.map((y) => (
          <div key={y.product} style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-main)', overflowWrap: 'anywhere' }}>{y.product}</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Sampel {nf.format(y.sample_qty)} {y.sample_unit} → terjual{' '}
              {y.parts.length === 0
                ? (y.label === '-' ? '-' : 'belum ada')
                : y.parts.map(p => `${nf.format(p.packs)} ${p.unit}${p.size ? ` (${p.size})` : ''}`).join(' + ')}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--info)', fontSize: '0.95rem', overflowWrap: 'anywhere' }} className="num">
              {y.label}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        Rasio Sampel → Penjualan{' '}
        <span title={HELP_SAMPLE_YIELD(radiusLabel)} style={{ cursor: 'help', color: 'var(--text-light)', display: 'inline-flex' }}><Info size={14} strokeWidth={1.75} /></span>
      </div>
      {body}
    </div>
  )
}
