'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

type ActivityItem = { name: string; count: number; pct: number }
type StatsData = { total: number; items: ActivityItem[] }

type ChartInnerProps = { items: ActivityItem[]; palette: string[]; total: number; label?: string }

// Recharts must render client-side only
const ChartInner = dynamic<ChartInnerProps>(() => import('@/components/CommodityChartInner'), { ssr: false, loading: () => (
  <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    Memuat grafik...
  </div>
) })

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#a3e635', '#6366f1'
]

export default function ActivitiesChart({ filterQuery = '' }: { filterQuery?: string }) {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cb-stats/activities${filterQuery}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filterQuery])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }} />
      Memuat statistik kegiatan...
    </div>
  )

  if (!data || data.total === 0) return (
    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: '2.5rem' }}>📊</div>
      <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Belum ada data kegiatan yang diinput.</p>
    </div>
  )

  const topItems = data.items

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>📊 Proporsi Semua Kegiatan</h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Berdasarkan total <strong>{data.total}</strong> laporan kegiatan dari user
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '2rem', alignItems: 'center' }}>
        {/* Left: Donut Chart */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <ChartInner items={topItems} palette={PALETTE} total={data.total} label="Kegiatan" />
        </div>

        {/* Right: Ranked list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {topItems.map((item, i) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Rank + color dot */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: PALETTE[i % PALETTE.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {i + 1}
              </div>
              {/* Name + bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem', flexShrink: 0 }}>{item.count}× ({item.pct}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: PALETTE[i % PALETTE.length], borderRadius: '999px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
