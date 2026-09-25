'use client'

import { dominantFase, FASE_CONFIG, FASE_ORDER, formatHa, SimotandiWilayahRow } from '@/lib/simotandi-fase'

type StorePoint = {
  id: string
  name: string
  code: string | null
  address: string | null
}

export default function RegionDetailPanel({
  nama,
  subtitle,
  row,
  stores,
  onClear,
}: {
  nama: string
  subtitle?: string
  row: SimotandiWilayahRow | null
  stores: StorePoint[]
  onClear: () => void
}) {
  const fase = row ? dominantFase(row) : null
  const maxVal = row ? Math.max(...FASE_ORDER.map((k) => row[k]), 1) : 1

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nama}
            </h3>
            {subtitle && <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClear}
            title="Hapus pilihan wilayah"
            style={{
              border: 'none',
              background: 'var(--surface-2)',
              borderRadius: '999px',
              width: 26,
              height: 26,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {fase && (
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: FASE_CONFIG[fase].color,
                color: '#1f2937',
              }}
            >
              {FASE_CONFIG[fase].label}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Standing Crop <strong>{formatHa(row!.standingCrop)} Ha</strong>
            </span>
          </div>
        )}
      </div>

      {/* Breakdown fase */}
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)' }}>
        {!row ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Belum ada data SIMOTANDI untuk wilayah ini.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {FASE_ORDER.map((key) => {
              const val = row[key]
              const pct = Math.round((val / maxVal) * 100)
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{FASE_CONFIG[key].short}</span>
                    <span style={{ fontWeight: 700 }}>{formatHa(val)} Ha</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: FASE_CONFIG[key].color,
                        borderRadius: 999,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Daftar toko */}
      <div style={{ padding: '0.85rem 1rem', overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          🏪 Toko di wilayah ini ({stores.length})
        </div>
        {stores.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tidak ada toko di wilayah ini.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {stores.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '0.5rem 0.6rem',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid #7c3aed',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.name}</div>
                {s.code && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.code}</div>}
                {s.address && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.address}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
