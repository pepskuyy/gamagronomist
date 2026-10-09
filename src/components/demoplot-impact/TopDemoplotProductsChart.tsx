'use client'

interface ProductStat {
  name: string
  count: number
}

interface Props {
  data: ProductStat[]
  loading?: boolean
  periodLabel?: string
}

export default function TopDemoplotProductsChart({ data, loading, periodLabel }: Props) {
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
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
            Produk Paling Sering Dipakai di Kegiatan
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Frekuensi penggunaan produk agrokimia dalam kegiatan demoplot di lapangan
          </p>
        </div>
        {periodLabel && (
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
            }}
          >
            📅 {periodLabel}
          </span>
        )}
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
                  fontWeight: 600,
                  color: '#334155',
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
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                      borderRadius: '6px',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#6d28d9',
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
