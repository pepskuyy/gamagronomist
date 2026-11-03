'use client'

import { OpportunityZone, ZoneStoreItem } from '@/lib/demoplot-opportunity'
import { AlertOctagon, Briefcase, CheckCircle2, Lightbulb, MapPin, Package, Sprout, Star, Store, Target, X, Zap } from 'lucide-react'

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
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Menghitung Zona Rekomendasi...
        </h4>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
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
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Target size={32} strokeWidth={1.5} style={{ marginBottom: '1rem', color: 'var(--text-light)' }} />
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Pilih Zona Rekomendasi
        </h3>
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
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
          bg: 'var(--danger-bg)',
          text: 'var(--danger)',
          border: 'var(--border)',
          icon: <AlertOctagon size={18} strokeWidth={1.75} />,
        }
      case 'amber':
        return {
          bg: 'var(--warning-bg)',
          text: 'var(--warning)',
          border: 'var(--border)',
          icon: <Zap size={18} strokeWidth={1.75} />,
        }
      case 'emerald':
        return {
          bg: 'var(--success-bg)',
          text: 'var(--success)',
          border: 'var(--border)',
          icon: <CheckCircle2 size={18} strokeWidth={1.75} />,
        }
      default:
        return {
          bg: 'var(--info-bg)',
          text: 'var(--info)',
          border: 'var(--border)',
          icon: <Lightbulb size={18} strokeWidth={1.75} />,
        }
    }
  }

  const badgeStyle = getUrgencyBadgeStyle()
  const stockedStores = zone.stores.filter((s) => s.has_dev_stock)
  const unstockedStores = zone.stores.filter((s) => !s.has_dev_stock)

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
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
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-main)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <span
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.5rem',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                Peringkat #{zone.rank}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Skor Peluang: <strong className="num" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{zone.score} / 100</strong>
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {zone.title}
            </h3>
            <p className="num" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Centroid: {zone.centroid.latitude.toFixed(4)}, {zone.centroid.longitude.toFixed(4)} • Radius: {zone.radius_km}<span className="unit">km</span>
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Tutup"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Salesmen involved */}
        {zone.salesmen_involved.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Briefcase size={14} strokeWidth={1.75} />
            <span>Sales Terkait:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
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
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ display: 'inline-flex', color: badgeStyle.text }}>{badgeStyle.icon}</span>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: badgeStyle.text }}>
              {zone.urgency_label}
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {zone.action_summary}
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Toko Berstok</div>
            <div className="num" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
              {zone.stocked_stores_count}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {zone.total_stores_in_radius}</span>
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nilai Stok Fokus</div>
            <div className="num" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
              {formatRp(zone.total_dev_stock_omset)}
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Demplot Terakhir</div>
            <div
              className="num"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: zone.last_demoplot_days_ago === null || zone.last_demoplot_days_ago > 90 ? 'var(--danger)' : 'var(--success)',
                marginTop: '0.25rem',
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
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Package size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Produk Pengembangan di Kios Area Ini
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {zone.dev_products_summary.map((prod, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{prod.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                      (<span className="num">{prod.store_count}</span> toko memasok)
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatRp(prod.total_omset)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: <span className="num">{prod.total_qty}</span><span className="unit">unit</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: Toko-toko yang Sudah Berstok (Wajib Dikawal Sell-Out) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Star size={16} strokeWidth={1.75} style={{ color: 'var(--warning)' }} /> Toko Sudah Kulakan Produk Fokus ({stockedStores.length})
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Perlu demplot agar stok terserap
            </span>
          </div>

          {stockedStores.length === 0 ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.4rem',
                background: 'var(--surface-2)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
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
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                        {st.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        <span className="num">{st.distance_km}</span><span className="unit">km</span> dari pusat • Sales: {st.default_salesman || '-'}
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
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      Riwayat 12 Bln
                    </button>
                  </div>

                  {/* List item yang dibeli toko ini */}
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                    {st.stocked_items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.125rem',
                        }}
                      >
                        <span>
                          • {it.product_name} (<span className="num">{it.quantity}</span><span className="unit">{it.unit}</span>)
                        </span>
                        <span className="num" style={{ fontWeight: 500 }}>
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
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Store size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Kios Sekitar / Potensi Spillover ({unstockedStores.length})
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Calon pembeli pasca demplot
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '180px', overflowY: 'auto' }}>
              {unstockedStores.map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{st.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span className="num">{st.distance_km}</span><span className="unit">km</span> • Sales: {st.default_salesman || '-'}
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
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-xs)',
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
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Sprout size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Riwayat Demplot di Radius 5 km ({zone.nearby_demoplots.length})
          </h4>

          {zone.nearby_demoplots.length === 0 ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.4rem',
                background: 'var(--danger-bg)',
                fontSize: '0.78rem',
                color: 'var(--danger)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <MapPin size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '0.125rem' }} /> Belum pernah ada kegiatan demplot sama sekali di radius 5 km wilayah ini dalam 12 bulan terakhir!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {zone.nearby_demoplots.slice(0, 3).map((dp) => (
                <div
                  key={dp.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>{dp.farmer_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{dp.date}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    Komoditas: {dp.commodity} • Jarak: <span className="num">{dp.distance_km}</span><span className="unit">km</span>
                  </div>
                  {dp.products.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
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
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Lightbulb size={14} strokeWidth={1.75} /> Rekomendasi Tindakan Agronomis:
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Hubungi Sales ({zone.salesmen_involved.join(', ') || 'Area Terkait'}) untuk konfirmasi kios tujuan, kemudian ajukan request produk dan buat titik demplot di lahan petani sentra komoditas sekitar radius ini.
        </div>
      </div>
    </div>
  )
}
