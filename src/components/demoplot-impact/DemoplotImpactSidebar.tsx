'use client'

import type { DemoplotImpactDetail, StoreImpactResult, DemoImpactSummary } from '@/lib/demoplot-impact'
import { formatKm } from '@/lib/impact-tier'
import { AlertTriangle, FlaskConical, MapPin, ShoppingCart, Store, TrendingDown, TrendingUp, User, X } from 'lucide-react'
import ImpactPenetrationCard from './ImpactPenetrationCard'
import SampleYieldCard from './SampleYieldCard'

interface Props {
  data: DemoplotImpactDetail | null
  loading: boolean
  error?: string | null
  onSelectStore: (store: StoreImpactResult) => void
  onClose?: () => void
  radiusKm: number
  /** Ringkasan dari daftar demplot (sumber yang sama dengan tabel). */
  impact: DemoImpactSummary | null
  impactLoading: boolean
}

export default function DemoplotImpactSidebar({ data, loading, error, onSelectStore, onClose, radiusKm, impact, impactLoading }: Props) {
  const radiusLabel = formatKm(radiusKm)
  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Menghitung Analitik Dampak...</h4>
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Mencocokkan toko dalam radius {radiusLabel} & komparasi faktur penjualan 60 hari.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1.5rem',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={16} strokeWidth={1.75} /> Gagal Memuat Analitik</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <MapPin size={32} strokeWidth={1.5} style={{ marginBottom: '1rem', color: 'var(--text-light)' }} />
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Pilih Titik Demoplot</h3>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.5 }}>
          Klik salah satu titik lingkaran pada peta untuk menganalisis dampak penjualan toko di sekitarnya (radius {radiusLabel}).
        </p>
      </div>
    )
  }

  const { demoplot, summary, product_impacts, stores } = data
  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
  const formatNumber = (n: number) => Math.round(n).toLocaleString('id-ID')

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '850px',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable Container */}
      <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* 1. Header Kegiatan */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {demoplot.farmerName}
              </h2>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
                aria-label="Tutup"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Badge Dampak */}
          <div style={{ marginTop: '0.5rem' }}>
            {summary.has_impact ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                Terindikasi berdampak pada penjualan
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid currentColor', flexShrink: 0 }} />
                Belum terindikasi berdampak penjualan
              </span>
            )}
          </div>

          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>{demoplot.commodity}</strong> • {demoplot.date}
          </div>

          <div style={{ marginTop: '0.375rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
            <MapPin size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> {demoplot.location_label} • <strong style={{ fontWeight: 500 }}>{demoplot.foName}</strong>
          </div>

          {demoplot.resultNotes && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.625rem 0.75rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              &ldquo;{demoplot.resultNotes}&rdquo;
            </div>
          )}
        </div>

        {/* 2. Produk yang Didemoplotkan */}
        <div>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <FlaskConical size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Produk yang Didemoplotkan
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {demoplot.products.map((p, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  background: 'var(--surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Dampak Pembelian */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <TrendingUp size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Dampak Pembelian (radius {radiusLabel})
            </h4>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {summary.total_stores_in_radius} toko dalam {radiusLabel} • perbandingan 60 hari sebelum vs sesudah demoplot
          </p>

          <ImpactPenetrationCard impact={impact} loading={impactLoading} radiusKm={radiusKm} />
          <SampleYieldCard impact={impact} loading={impactLoading} radiusKm={radiusKm} />

          {/* Cards Omset Sebelum vs Sesudah */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                padding: '0.75rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                Omset Sebelum
              </div>
              <div className="num" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {formatRp(summary.before_omset)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                <span className="num">{summary.before_invoices_count}</span> invoice
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                background: 'var(--success-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--success)' }}>
                Omset Sesudah
              </div>
              <div className="num" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--success)', marginTop: '0.25rem' }}>
                {formatRp(summary.after_omset)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.125rem' }}>
                <span className="num">{summary.after_invoices_count}</span> invoice
              </div>
            </div>
          </div>

          {/* Per-Product Impact Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {product_impacts.map((pi, idx) => {
              // Qty faktur bisa bercampur satuan (Btl, Box, ...), jadi tanda naik/turun tanpa angka
              const deltaTag = pi.delta_qty > 0 ? 'Naik' : pi.delta_qty < 0 ? 'Turun' : 'Tetap'
              return (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>{pi.product_name}</strong>
                    <span
                      style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: pi.delta_qty > 0 ? 'var(--success-bg)' : 'var(--surface-2)',
                        color: pi.delta_qty > 0 ? 'var(--success)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {pi.delta_qty > 0 ? <TrendingUp size={14} strokeWidth={1.75} /> : pi.delta_qty < 0 ? <TrendingDown size={14} strokeWidth={1.75} /> : null}
                      {deltaTag}
                    </span>
                  </div>

                  <div className="num" style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Sebelum: {pi.before_label} ({formatRp(pi.before_omset)}) → Sesudah: {pi.after_label} ({formatRp(pi.after_omset)})
                  </div>

                  {pi.is_new && (
                    <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--success)' }}>
                      Pembelian baru muncul setelah demoplot
                    </div>
                  )}

                  {pi.matched_skus && pi.matched_skus.length > 0 && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Produk invoice: {pi.matched_skus.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. Toko dalam radius */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Store size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Toko Radius {radiusLabel} ({stores.length})
            </h4>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                background: summary.impacted_stores_count > 0 ? 'var(--success-bg)' : 'var(--surface-2)',
                color: summary.impacted_stores_count > 0 ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              <span className="num">{summary.impacted_stores_count}</span> Terdampak Penjualan
            </span>
          </div>

          {stores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Tidak ada toko berkoordinat dalam radius {radiusLabel} dari lokasi kegiatan ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stores.map((st) => (
                <div
                  key={st.customer_id}
                  onClick={() => onSelectStore(st)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${st.has_impact ? 'var(--success)' : 'var(--border)'}`,
                    background: st.has_impact ? 'var(--success-bg)' : 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)')}
                  title="Klik untuk melihat riwayat faktur pembelian 12 bulan terakhir"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>{st.name}</strong>
                      {st.has_impact && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.125rem 0.375rem',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: 'var(--surface)',
                              color: 'var(--success)',
                            }}
                          >
                            Terdampak
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <span className="num">{st.distance_km}</span><span className="unit">km</span>
                    </span>
                  </div>

                  {st.has_impact && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.625rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                      <div className="num" style={{ fontWeight: 500, color: 'var(--success)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <ShoppingCart size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} /> +{st.impact_label} Penjualan Produk Demplot ({formatRp(st.impact_total_omset)})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {st.impact_products.map((ip, i) => (
                          <span key={i}>
                            {ip.product_name} (<span className="num">{ip.quantity}</span><span className="unit">{ip.unit}</span>)
                            {ip.is_new && <strong style={{ color: 'var(--warning)', fontWeight: 500 }}> Produk Baru</strong>}
                            {i < st.impact_products.length - 1 ? ' • ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{st.customer_no || ''} {st.city || ''}</span>
                    {st.default_salesman && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} strokeWidth={1.75} /> {st.default_salesman}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
