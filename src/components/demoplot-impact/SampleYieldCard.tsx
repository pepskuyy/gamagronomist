'use client'

import type { DemoImpactSummary, ProductImpactResult } from '@/lib/demoplot-impact'
import { formatKm, formatPcsPerLiter, formatLiterKg, formatVolumeRatio, HELP_SAMPLE_YIELD } from '@/lib/impact-tier'

interface Props {
  /** Ringkasan dari daftar demplot (sumber yang sama dengan tabel) */
  impact: DemoImpactSummary | null
  loading: boolean
  radiusKm: number
  /** Rincian per produk dari detail demplot */
  products: ProductImpactResult[]
}

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

function Metric({ value, caption }: { value: string; caption: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0369a1', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>{caption}</div>
    </div>
  )
}

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
    const reason: Record<string, string> = {
      farmer_product: 'Demplot ini memakai produk milik petani, bukan sampel dari stok, sehingga rasio sampel tidak dihitung.',
      no_gramasi: 'Data isi per kemasan (ml/gr) produk demplot belum diisi di Master Produk, sehingga sampel tidak bisa dihitung dalam liter/kg.',
      no_usage: 'Belum ada pemakaian produk yang tercatat pada demplot ini.',
    }
    body = <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{reason[impact.sample_status] ?? 'Rasio sampel tidak dapat dihitung.'}</div>
  } else {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Metric value={formatPcsPerLiter(impact.pcs_per_liter_kg)} caption="PCS SKU sama per 1 L/kg sampel" />
          <Metric value={formatVolumeRatio(impact.volume_per_liter_kg)} caption="Volume terjual dibanding volume sampel" />
        </div>
        <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
          {formatLiterKg(impact.sample_liter_kg)} sampel → {nf.format(Math.max(0, impact.sold_after_qty_sampled))} PCS SKU sama ·{' '}
          {formatLiterKg(Math.max(0, impact.sold_volume_liter_kg))} terjual (semua ukuran), 60 hari sesudah demplot
        </div>
        {sampled.length > 0 && (
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {sampled.map(p => (
              <div key={p.product_name} style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {p.product_name} · sampel {nf.format(p.sample_qty)} {p.sample_unit}
                </div>
                <div style={{ color: '#475569' }}>
                  {p.same_sku_after_pcs === null
                    ? 'SKU belum terhubung ke Accurate'
                    : `${nf.format(Math.max(0, p.same_sku_after_pcs))} PCS SKU sama (${p.pcs_per_liter_kg === null ? '-' : `${nf.format(p.pcs_per_liter_kg)}/L·kg`})`}
                  {' · '}
                  {formatLiterKg(Math.max(0, p.sold_volume_liter_kg))} terjual ({formatVolumeRatio(p.volume_per_liter_kg)})
                </div>
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
