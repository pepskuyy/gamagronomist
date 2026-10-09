'use client'

import { DemoplotImpactDetail, StoreImpactResult } from '@/lib/demoplot-impact'

interface Props {
  data: DemoplotImpactDetail | null
  loading: boolean
  error?: string | null
  onSelectStore: (store: StoreImpactResult) => void
  onClose?: () => void
}

export default function DemoplotImpactSidebar({ data, loading, error, onSelectStore, onClose }: Props) {
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
          background: '#ffffff',
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
            border: '3.5px solid #e2e8f0',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Menghitung Analitik Dampak...</h4>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Mencocokkan toko dalam radius 5 km & komparasi faktur penjualan 60 hari.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1.5rem',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ Gagal Memuat Analitik</div>
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
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Pilih Titik Demoplot</h3>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.5 }}>
          Klik salah satu titik lingkaran pada peta untuk menganalisis dampak penjualan toko di sekitarnya (radius 5 km).
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
        background: '#ffffff',
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
              <span style={{ fontSize: '1.3rem' }}>🌱</span>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                {demoplot.farmerName}
              </h2>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: '9999px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
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
                  gap: '0.35rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}
              >
                🌿 Terindikasi berdampak pada penjualan
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                }}
              >
                ⚪ Belum terindikasi berdampak penjualan
              </span>
            )}
          </div>

          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>{demoplot.commodity}</strong> • {demoplot.date}
          </div>

          <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#475569' }}>
            📍 {demoplot.location_label} • <strong>{demoplot.foName}</strong>
          </div>

          {demoplot.resultNotes && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem 0.85rem',
                background: '#fffbeb',
                borderLeft: '3px solid #f59e0b',
                borderRadius: '0.35rem',
                fontSize: '0.8rem',
                fontStyle: 'italic',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              &ldquo;{demoplot.resultNotes}&rdquo;
            </div>
          )}
        </div>

        {/* 2. Produk yang Didemoplotkan */}
        <div>
          <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
            🧪 Produk yang Didemoplotkan
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {demoplot.products.map((p, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Dampak Pembelian (radius 5 km) */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              📈 Dampak Pembelian (radius 5 km)
            </h4>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {summary.total_stores_in_radius} toko dalam 5 km • perbandingan 60 hari sebelum vs sesudah demoplot
          </p>

          {/* Cards Omset Sebelum vs Sesudah */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                padding: '0.85rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.65rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Omset Sebelum
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>
                {formatRp(summary.before_omset)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {summary.before_invoices_count} invoice
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.65rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Omset Sesudah
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                {formatRp(summary.after_omset)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: '0.15rem' }}>
                {summary.after_invoices_count} invoice
              </div>
            </div>
          </div>

          {/* Per-Product Impact Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {product_impacts.map((pi, idx) => {
              const deltaTag = pi.delta_qty > 0 ? `▲ ${formatNumber(pi.delta_qty)}` : pi.delta_qty < 0 ? `▼ ${formatNumber(Math.abs(pi.delta_qty))}` : '= 0'
              return (
                <div
                  key={idx}
                  style={{
                    padding: '0.85rem',
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: '0.65rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{pi.product_name}</strong>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: pi.delta_qty > 0 ? '#dcfce7' : '#f1f5f9',
                        color: pi.delta_qty > 0 ? '#15803d' : '#64748b',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {deltaTag}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Sebelum: {pi.before_qty} {pi.unit} ({formatRp(pi.before_omset)}) → Sesudah: {pi.after_qty} {pi.unit} ({formatRp(pi.after_omset)})
                  </div>

                  {pi.is_new && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#15803d' }}>
                      ✨ Pembelian baru muncul setelah demoplot
                    </div>
                  )}

                  {pi.matched_skus && pi.matched_skus.length > 0 && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                      Produk invoice: {pi.matched_skus.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. Toko Radius 5 km */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              🏪 Toko Radius 5 km ({stores.length})
            </h4>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                background: summary.impacted_stores_count > 0 ? '#f0fdf4' : '#f1f5f9',
                color: summary.impacted_stores_count > 0 ? '#15803d' : '#64748b',
                border: summary.impacted_stores_count > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              }}
            >
              ⭐ {summary.impacted_stores_count} Terdampak Penjualan
            </span>
          </div>

          {stores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--surface-2)', borderRadius: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Tidak ada toko berkoordinat dalam radius 5 km dari lokasi kegiatan ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stores.map((st) => (
                <div
                  key={st.customer_id}
                  onClick={() => onSelectStore(st)}
                  style={{
                    padding: '0.9rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${st.has_impact ? '#86efac' : 'var(--border)'}`,
                    borderLeft: `3.5px solid ${st.has_impact ? '#16a34a' : '#94a3b8'}`,
                    background: st.has_impact ? '#f0fdf4' : '#ffffff',
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
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{st.name}</strong>
                      {st.has_impact && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '9999px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#15803d',
                            }}
                          >
                            ⭐ Terdampak
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                      {st.distance_km} km
                    </span>
                  </div>

                  {st.has_impact && (
                    <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.65rem', background: '#ffffff', borderRadius: '0.45rem', border: '1px solid #bbf7d0', fontSize: '0.78rem' }}>
                      <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.2rem' }}>
                        🛒 +{formatNumber(st.impact_total_qty)} PCS Penjualan Produk Demplot ({formatRp(st.impact_total_omset)})
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.74rem' }}>
                        {st.impact_products.map((ip, i) => (
                          <span key={i}>
                            {ip.product_name} ({ip.quantity} {ip.unit})
                            {ip.is_new && <strong style={{ color: '#d97706' }}> ✨ Produk Baru</strong>}
                            {i < st.impact_products.length - 1 ? ' • ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <span>{st.customer_no || ''} {st.city || ''}</span>
                    {st.default_salesman && <span>👤 {st.default_salesman}</span>}
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
