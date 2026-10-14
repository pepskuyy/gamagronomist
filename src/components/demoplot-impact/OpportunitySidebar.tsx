'use client'

import { OpportunityZone, ZoneStoreItem } from '@/lib/demoplot-opportunity'

interface Props {
  zone: OpportunityZone | null
  loading: boolean
  onSelectStore: (store: any) => void
  onClose?: () => void
}

export default function OpportunitySidebar({ zone, loading, onSelectStore, onClose }: Props) {
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
          borderRadius: 'var(--radius-lg, 0.75rem)',
          border: '1px solid var(--border, #e2e8f0)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3.5px solid #e2e8f0',
            borderTopColor: '#0284c7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
          Menghitung Zona Rekomendasi...
        </h4>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
          Memindai klaster 2.980 toko, histori invoice penjualan, dan kekosongan demplot.
        </p>
      </div>
    )
  }

  if (!zone) {
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
          borderRadius: 'var(--radius-lg, 0.75rem)',
          border: '1px solid var(--border, #e2e8f0)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
          Pilih Zona Rekomendasi
        </h3>
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.85rem',
            color: '#64748b',
            maxWidth: '300px',
            lineHeight: 1.5,
          }}
        >
          Klik salah satu lingkaran zona rekomendasi pada peta atau pilih dari daftar peringkat untuk melihat rincian toko dan peluang pengawalan produk.
        </p>
      </div>
    )
  }

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  const getUrgencyBadgeStyle = () => {
    switch (zone.urgency_badge_color) {
      case 'red':
        return {
          bg: '#fef2f2',
          text: '#991b1b',
          border: '#fecaca',
          icon: '🚨',
        }
      case 'amber':
        return {
          bg: '#fffbeb',
          text: '#92400e',
          border: '#fde68a',
          icon: '⚡',
        }
      case 'emerald':
        return {
          bg: '#f0fdf4',
          text: '#166534',
          border: '#bbf7d0',
          icon: '✅',
        }
      default:
        return {
          bg: '#eff6ff',
          text: '#1e40af',
          border: '#bfdbfe',
          icon: '💡',
        }
    }
  }

  const badgeStyle = getUrgencyBadgeStyle()
  const stockedStores = zone.stores.filter((s) => s.has_dev_stock)
  const unstockedStores = zone.stores.filter((s) => !s.has_dev_stock)

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg, 0.75rem)',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  background: '#f59e0b',
                  color: '#000000',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                Peringkat #{zone.rank}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Skor Peluang: <strong style={{ color: '#38bdf8' }}>{zone.score} / 100</strong>
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
              {zone.title}
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Centroid: {zone.centroid.latitude.toFixed(4)}, {zone.centroid.longitude.toFixed(4)} • Radius: {zone.radius_km} km
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '0.375rem',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '0.35rem 0.55rem',
                fontSize: '0.85rem',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Salesmen involved */}
        {zone.salesmen_involved.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <span>💼 Sales Terkait:</span>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
              {zone.salesmen_involved.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Content Body */}
      <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Urgency Action Banner */}
        <div
          style={{
            background: badgeStyle.bg,
            border: `1px solid ${badgeStyle.border}`,
            borderRadius: '0.65rem',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.1rem' }}>{badgeStyle.icon}</span>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: badgeStyle.text }}>
              {zone.urgency_label}
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
            {zone.action_summary}
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Toko Berstok</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ea580c', marginTop: '0.2rem' }}>
              {zone.stocked_stores_count}
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}> / {zone.total_stores_in_radius}</span>
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Nilai Stok Fokus</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {formatRp(zone.total_dev_stock_omset)}
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Demplot Terakhir</div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: zone.last_demoplot_days_ago === null || zone.last_demoplot_days_ago > 90 ? '#ef4444' : '#10b981',
                marginTop: '0.2rem',
              }}
            >
              {zone.last_demoplot_days_ago !== null
                ? `${zone.last_demoplot_days_ago} hari lalu`
                : 'Nihil'}
            </div>
          </div>
        </div>

        {/* Rincian Produk Pengembangan yang Tersedia di Toko */}
        {zone.dev_products_summary.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              📦 Produk Pengembangan di Kios Area Ini
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {zone.dev_products_summary.map((prod, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '0.4rem',
                    background: '#fff7ed',
                    border: '1px solid #ffedd5',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: '#9a3412' }}>{prod.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#c2410c', marginLeft: '0.4rem' }}>
                      ({prod.store_count} toko memasok)
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatRp(prod.total_omset)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Qty: {prod.total_qty} unit</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: Toko-toko yang Sudah Berstok (Wajib Dikawal Sell-Out) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#ea580c' }}>
              ⭐ Toko Sudah Kulakan Produk Fokus ({stockedStores.length})
            </h4>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Perlu demplot agar stok terserap
            </span>
          </div>

          {stockedStores.length === 0 ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.4rem',
                background: '#f8fafc',
                fontSize: '0.78rem',
                color: '#64748b',
                textAlign: 'center',
              }}
            >
              Belum ada toko yang kulakan produk fokus ini. Ini adalah zona demand creation baru.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stockedStores.map((st) => (
                <div
                  key={st.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #fed7aa',
                    background: '#fffaf5',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.85rem' }}>
                        {st.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                        {st.distance_km} km dari pusat • Sales: {st.default_salesman || '-'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectStore({
                          customer_id: st.id,
                          name: st.name,
                          city: st.city,
                          default_salesman: st.default_salesman,
                          distance_km: st.distance_km,
                        })
                      }
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: '#ffffff',
                        border: '1px solid #fdba74',
                        color: '#c2410c',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                      }}
                    >
                      Riwayat 12 Bln
                    </button>
                  </div>

                  {/* List item yang dibeli toko ini */}
                  <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px dashed #fed7aa' }}>
                    {st.stocked_items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.74rem',
                          color: '#431407',
                          marginTop: '0.15rem',
                        }}
                      >
                        <span>
                          • {it.product_name} ({it.quantity} {it.unit})
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatRp(it.omset)} (tgl {it.last_invoice_date})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION: Toko-toko Sekitar yang Belum Memasok (Potensi Spillover) */}
        {unstockedStores.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                🏪 Kios Sekitar / Potensi Spillover ({unstockedStores.length})
              </h4>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Calon pembeli pasca demplot
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
              {unstockedStores.map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{st.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {st.distance_km} km • Sales: {st.default_salesman || '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectStore({
                        customer_id: st.id,
                        name: st.name,
                        city: st.city,
                        default_salesman: st.default_salesman,
                        distance_km: st.distance_km,
                      })
                    }
                    style={{
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    Riwayat
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: Riwayat Demplot Terdekat */}
        <div>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
            🌾 Riwayat Demplot di Radius 5 km ({zone.nearby_demoplots.length})
          </h4>

          {zone.nearby_demoplots.length === 0 ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.4rem',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                fontSize: '0.78rem',
                color: '#b91c1c',
                fontWeight: 600,
              }}
            >
              📍 Belum pernah ada kegiatan demplot sama sekali di radius 5 km wilayah ini dalam 12 bulan terakhir!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {zone.nearby_demoplots.slice(0, 3).map((dp) => (
                <div
                  key={dp.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '0.76rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#1e293b' }}>
                    <span>{dp.farmer_name}</span>
                    <span style={{ color: '#64748b' }}>{dp.date}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Komoditas: {dp.commodity} • Jarak: {dp.distance_km} km
                  </div>
                  {dp.products.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '0.15rem' }}>
                      Produk: {dp.products.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Card */}
      <div
        style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border, #e2e8f0)',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
          💡 Rekomendasi Tindakan Agronomis:
        </div>
        <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>
          Hubungi Sales ({zone.salesmen_involved.join(', ') || 'Area Terkait'}) untuk konfirmasi kios tujuan, kemudian ajukan request produk dan buat titik demplot di lahan petani sentra komoditas sekitar radius ini.
        </div>
      </div>
    </div>
  )
}
