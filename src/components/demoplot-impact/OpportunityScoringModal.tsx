'use client'

interface Props {
  isOpen: boolean
  onClose: () => void
}

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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: '1rem',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🎯</span>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#ffffff' }}>
                Mekanisme & Formula Skoring Opportunity Finder
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Formula objektif pemeringkatan lokasi demo plot berbasis radius 5 km, data penjualan sales, dan kekosongan edukasi
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '0.375rem',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.4rem 0.6rem',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Intro Box */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              color: '#166534',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.3rem' }}>
              <span>💡</span>
              <span>Prinsip Dasar: Strategi &quot;Follow-The-Sales&quot;</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#15803d', lineHeight: 1.5 }}>
              Alur kerja tidak selalu agronomis menciptakan permintaan (demand creation) lebih dulu, tetapi sering kali sebaliknya: <strong>Tim Sales sudah berhasil memasok produk fokus ke kios binaan</strong>. Jika petani sekitar belum teredukasi, stok tersebut berisiko macet di rak kios. Sistem ini menghitung skor untuk memandu tim agronomis segera mendampingi area tersebut dengan demo plot.
            </p>
          </div>

          {/* 3 Pilar Pembobotan Skor */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              📊 3 Pilar Penentu Skor Peluang (Total 0 – 100 Poin)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {/* Pilar 1 */}
              <div
                style={{
                  background: '#fffaf5',
                  border: '1.5px solid #fed7aa',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#9a3412' }}>
                    1. Follow-The-Sales
                  </div>
                  <span
                    style={{
                      background: '#ea580c',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    Maks 55 Poin
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#431407', lineHeight: 1.5 }}>
                  Menilai apakah kios di radius 5 km sudah membeli produk fokus dari sales dalam 90 hari terakhir:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: '#7c2d12', lineHeight: 1.5 }}>
                  <li><strong>+35 Poin:</strong> Ada minimal 1 kios yang sudah kulakan produk fokus.</li>
                  <li><strong>+5 Poin / kios:</strong> Dikalikan per jumlah kios berstok (maks +15 poin).</li>
                  <li><strong>+5 Poin:</strong> Nilai omset stok produk fokus di kios ≥ Rp 3.000.000.</li>
                </ul>
              </div>

              {/* Pilar 2 */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>
                    2. Blank Spot Edukasi
                  </div>
                  <span
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    Maks 40 Poin
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.5 }}>
                  Menilai riwayat kekosongan demplot di radius 5 km agar biaya promosi efektif:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                  <li><strong>+30 Poin:</strong> Belum pernah ada demplot dalam 12 bulan terakhir.</li>
                  <li><strong>+25 Poin:</strong> Demplot terakhir sudah &gt; 6 bulan lalu.</li>
                  <li><strong>+15 Poin:</strong> Demplot terakhir sudah &gt; 3 bulan lalu.</li>
                  <li><strong>+10 Poin:</strong> Produk fokus ini belum pernah didemplotkan di area tsb.</li>
                  <li><strong style={{ color: '#dc2626' }}>-35 Poin (Penalti):</strong> Baru ada demplot &lt; 60 hari lalu.</li>
                </ul>
              </div>

              {/* Pilar 3 */}
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0369a1' }}>
                    3. Densitas Kios Sekitar
                  </div>
                  <span
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    Maks 15 Poin
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                  Daya ungkit (leverage): 1 demplot berdampak serentak ke banyak kios tetangga (spillover):
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: '#075985', lineHeight: 1.5 }}>
                  <li><strong>+15 Poin:</strong> Klaster padat (≥ 6 kios binaan dalam radius 5 km).</li>
                  <li><strong>+10 Poin:</strong> Klaster sedang (3 – 5 kios binaan).</li>
                  <li><strong>+5 Poin:</strong> Klaster kecil (1 – 2 kios binaan).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Klasifikasi Status & Rekomendasi Tindakan */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              🚦 Klasifikasi Status & Rekomendasi Tindakan Lapangan
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* Status 1 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🚨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.84rem' }}>
                      Wajib Segera Demplot (Kawal Sell-Out)
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c' }}>
                      Skor ≥ 70
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#450a0a', marginTop: '0.2rem', lineHeight: 1.45 }}>
                    Kios binaan sudah memasok produk fokus dari sales, namun nihil edukasi demplot. <strong>Tindakan:</strong> FO/AFA wajib berkoordinasi dengan sales terkait dan memprioritaskan jadwal demplot di desa sekitar kios agar produk segera diserap petani.
                  </div>
                </div>
              </div>

              {/* Status 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#92400e', fontSize: '0.84rem' }}>
                      Kawal Penyerapan Stok
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                      Skor 50 – 69
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '0.2rem', lineHeight: 1.45 }}>
                    Kios ada stok produk fokus, namun jumlah kios lebih sedikit atau demplot lampau sudah mulai berjarak waktu. <strong>Tindakan:</strong> Masuk dalam antrean pendampingan lapangan periode berjalan.
                  </div>
                </div>
              </div>

              {/* Status 3 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>💡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.84rem' }}>
                      Peluang Penetrasi Pasar Baru
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#dbeafe', color: '#1d4ed8' }}>
                      Demand Creation
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#1e3a8a', marginTop: '0.2rem', lineHeight: 1.45 }}>
                    Klaster kios padat, namun produk fokus belum pernah masuk ke kios-kios tersebut. <strong>Tindakan:</strong> Demplot di sini berfungsi sebagai daya tarik pertama (demand creation) agar kios mulai memesan produk fokus ke sales.
                  </div>
                </div>
              </div>

              {/* Status 4 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#166534', fontSize: '0.84rem' }}>
                      Wilayah Terawat (Baru Ada Demplot)
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#dcfce7', color: '#15803d' }}>
                      &lt; 60 Hari Lalu
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#14532d', marginTop: '0.2rem', lineHeight: 1.45 }}>
                    Baru ada kegiatan demplot dalam 60 hari terakhir. Sistem memberikan penalti skor agar anggaran promosi tidak boros di titik yang sama. <strong>Tindakan:</strong> Pantau dampak penjualan di tab Evaluasi Dampak.
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
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Data dihitung otomatis menggunakan formula spasial Haversine &amp; transaksi riil Sales Dashboard
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Mengerti &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
