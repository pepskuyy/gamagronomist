'use client'

import { Calendar } from 'lucide-react'

interface ProductStat {
  name: string
  count: number
}

interface Props {
  data: ProductStat[]
  loading?: boolean
  periodLabel?: string
  activeType?: 'demoplot' | 'spot-demplot' | 'all'
  onTypeChange?: (type: 'demoplot' | 'spot-demplot' | 'all') => void
}

export default function TopDemoplotProductsChart({
  data,
  loading,
  periodLabel,
  activeType = 'demoplot',
  onTypeChange,
}: Props) {
  if (loading) {
    return (
      <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Memuat statistik produk...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return null
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Produk Paling Sering Dipakai di Kegiatan
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Frekuensi penggunaan produk agrokimia dalam kegiatan demoplot di lapangan
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onTypeChange && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => onTypeChange('demoplot')}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeType === 'demoplot' ? 'var(--surface)' : 'transparent',
                  color: activeType === 'demoplot' ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: activeType === 'demoplot' ? 'var(--shadow-xs)' : 'none',
                  transition: 'var(--transition)',
                }}
              >
                Demplot
              </button>
              <button
                type="button"
                onClick={() => onTypeChange('spot-demplot')}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeType === 'spot-demplot' ? 'var(--surface)' : 'transparent',
                  color: activeType === 'spot-demplot' ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: activeType === 'spot-demplot' ? 'var(--shadow-xs)' : 'none',
                  transition: 'var(--transition)',
                }}
              >
                Spot Demplot
              </button>
              <button
                type="button"
                onClick={() => onTypeChange('all')}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeType === 'all' ? 'var(--surface)' : 'transparent',
                  color: activeType === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: activeType === 'all' ? 'var(--shadow-xs)' : 'none',
                  transition: 'var(--transition)',
                }}
              >
                Semua
              </button>
            </div>
          )}
          {periodLabel && (
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <Calendar size={14} strokeWidth={1.75} /> {periodLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.map((item, idx) => {
          const pct = Math.round((item.count / maxCount) * 100)
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '200px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={item.name}
              >
                {item.name}
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    flex: 1,
                    height: '24px',
                    background: 'var(--surface-2)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: idx === 0 ? 'var(--primary)' : idx < 3 ? '#a3a3a3' : '#d4d4d4',
                      borderRadius: '6px',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <span
                  className="num"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: idx === 0 ? 600 : 500,
                    color: idx === 0 ? 'var(--text-main)' : 'var(--text-secondary)',
                    width: '55px',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {item.count}×
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
