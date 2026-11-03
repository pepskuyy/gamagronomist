'use client'

import { AlertOctagon, BarChart3, CheckCircle2, Lightbulb, Signpost, Target, X, Zap } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const pillarCard: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

const pillarTitle: React.CSSProperties = { fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }

const pillarBadge: React.CSSProperties = {
  background: 'var(--surface-2)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-light)',
  fontSize: '0.75rem',
  fontWeight: 500,
  padding: '0.125rem 0.5rem',
  borderRadius: 'var(--radius-xs)',
  whiteSpace: 'nowrap',
}

const pillarIntro: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }

const pillarList: React.CSSProperties = { margin: 0, paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }

const statusRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
}

const statusTag = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '0.75rem',
  fontWeight: 500,
  padding: '0.125rem 0.375rem',
  borderRadius: 'var(--radius-xs)',
  background: bg,
  color,
})

const statusBody: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.45 }

export default function OpportunityScoringModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(23, 23, 23, 0.4)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            background: 'var(--surface)',
            color: 'var(--text-main)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Mekanisme & Formula Skoring Opportunity Finder
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Formula objektif pemeringkatan lokasi demo plot berbasis radius 5 km, data penjualan sales, dan kekosongan edukasi
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Intro Box */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              <Lightbulb size={16} strokeWidth={1.75} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>Prinsip Dasar: Strategi &quot;Follow-The-Sales&quot;</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Alur kerja tidak selalu agronomis menciptakan permintaan (demand creation) lebih dulu, tetapi sering kali sebaliknya: <strong style={{ fontWeight: 600, color: 'var(--text-main)' }}>Tim Sales sudah berhasil memasok produk fokus ke kios binaan</strong>. Jika petani sekitar belum teredukasi, stok tersebut berisiko macet di rak kios. Sistem ini menghitung skor untuk memandu tim agronomis segera mendampingi area tersebut dengan demo plot.
            </p>
          </div>

          {/* 3 Pilar Pembobotan Skor */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> 3 Pilar Penentu Skor Peluang (Total 0 – 100 Poin)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {/* Pilar 1 */}
              <div style={pillarCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={pillarTitle}>
                    1. Follow-The-Sales
                  </div>
                  <span className="num" style={pillarBadge}>
                    Maks 55 Poin
                  </span>
                </div>
                <div style={pillarIntro}>
                  Menilai apakah kios di radius 5 km sudah membeli produk fokus dari sales dalam 90 hari terakhir:
                </div>
                <ul style={pillarList}>
                  <li><strong style={{ fontWeight: 600 }}>+35 Poin:</strong> Ada minimal 1 kios yang sudah kulakan produk fokus.</li>
                  <li><strong style={{ fontWeight: 600 }}>+5 Poin / kios:</strong> Dikalikan per jumlah kios berstok (maks +15 poin).</li>
                  <li><strong style={{ fontWeight: 600 }}>+5 Poin:</strong> Nilai omset stok produk fokus di kios ≥ Rp 3.000.000.</li>
                </ul>
              </div>

              {/* Pilar 2 */}
              <div style={pillarCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={pillarTitle}>
                    2. Blank Spot Edukasi
                  </div>
                  <span className="num" style={pillarBadge}>
                    Maks 40 Poin
                  </span>
                </div>
                <div style={pillarIntro}>
                  Menilai riwayat kekosongan demplot di radius 5 km agar biaya promosi efektif:
                </div>
                <ul style={pillarList}>
                  <li><strong style={{ fontWeight: 600 }}>+30 Poin:</strong> Belum pernah ada demplot dalam 12 bulan terakhir.</li>
                  <li><strong style={{ fontWeight: 600 }}>+25 Poin:</strong> Demplot terakhir sudah &gt; 6 bulan lalu.</li>
                  <li><strong style={{ fontWeight: 600 }}>+15 Poin:</strong> Demplot terakhir sudah &gt; 3 bulan lalu.</li>
                  <li><strong style={{ fontWeight: 600 }}>+10 Poin:</strong> Produk fokus ini belum pernah didemplotkan di area tsb.</li>
                  <li><strong style={{ fontWeight: 600, color: 'var(--danger)' }}>-35 Poin (Penalti):</strong> Baru ada demplot &lt; 60 hari lalu.</li>
                </ul>
              </div>

              {/* Pilar 3 */}
              <div style={pillarCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={pillarTitle}>
                    3. Densitas Kios Sekitar
                  </div>
                  <span className="num" style={pillarBadge}>
                    Maks 15 Poin
                  </span>
                </div>
                <div style={pillarIntro}>
                  Daya ungkit (leverage): 1 demplot berdampak serentak ke banyak kios tetangga (spillover):
                </div>
                <ul style={pillarList}>
                  <li><strong style={{ fontWeight: 600 }}>+15 Poin:</strong> Klaster padat (≥ 6 kios binaan dalam radius 5 km).</li>
                  <li><strong style={{ fontWeight: 600 }}>+10 Poin:</strong> Klaster sedang (3 – 5 kios binaan).</li>
                  <li><strong style={{ fontWeight: 600 }}>+5 Poin:</strong> Klaster kecil (1 – 2 kios binaan).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Klasifikasi Status & Rekomendasi Tindakan */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Signpost size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Klasifikasi Status & Rekomendasi Tindakan Lapangan
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Status 1 */}
              <div style={statusRow}>
                <AlertOctagon size={18} strokeWidth={1.75} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      Wajib Segera Demplot (Kawal Sell-Out)
                    </span>
                    <span className="num" style={statusTag('var(--danger-bg)', 'var(--danger)')}>
                      Skor ≥ 70
                    </span>
                  </div>
                  <div style={statusBody}>
                    Kios binaan sudah memasok produk fokus dari sales, namun nihil edukasi demplot. <strong style={{ fontWeight: 600 }}>Tindakan:</strong> FO/AFA wajib berkoordinasi dengan sales terkait dan memprioritaskan jadwal demplot di desa sekitar kios agar produk segera diserap petani.
                  </div>
                </div>
              </div>

              {/* Status 2 */}
              <div style={statusRow}>
                <Zap size={18} strokeWidth={1.75} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      Kawal Penyerapan Stok
                    </span>
                    <span className="num" style={statusTag('var(--warning-bg)', 'var(--warning)')}>
                      Skor 50 – 69
                    </span>
                  </div>
                  <div style={statusBody}>
                    Kios ada stok produk fokus, namun jumlah kios lebih sedikit atau demplot lampau sudah mulai berjarak waktu. <strong style={{ fontWeight: 600 }}>Tindakan:</strong> Masuk dalam antrean pendampingan lapangan periode berjalan.
                  </div>
                </div>
              </div>

              {/* Status 3 */}
              <div style={statusRow}>
                <Lightbulb size={18} strokeWidth={1.75} style={{ color: 'var(--info)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      Peluang Penetrasi Pasar Baru
                    </span>
                    <span style={statusTag('var(--info-bg)', 'var(--info)')}>
                      Demand Creation
                    </span>
                  </div>
                  <div style={statusBody}>
                    Klaster kios padat, namun produk fokus belum pernah masuk ke kios-kios tersebut. <strong style={{ fontWeight: 600 }}>Tindakan:</strong> Demplot di sini berfungsi sebagai daya tarik pertama (demand creation) agar kios mulai memesan produk fokus ke sales.
                  </div>
                </div>
              </div>

              {/* Status 4 */}
              <div style={statusRow}>
                <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      Wilayah Terawat (Baru Ada Demplot)
                    </span>
                    <span className="num" style={statusTag('var(--success-bg)', 'var(--success)')}>
                      &lt; 60 Hari Lalu
                    </span>
                  </div>
                  <div style={statusBody}>
                    Baru ada kegiatan demplot dalam 60 hari terakhir. Sistem memberikan penalti skor agar anggaran promosi tidak boros di titik yang sama. <strong style={{ fontWeight: 600 }}>Tindakan:</strong> Pantau dampak penjualan di tab Evaluasi Dampak.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Data dihitung otomatis menggunakan formula spasial Haversine &amp; transaksi riil Sales Dashboard
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Mengerti &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
