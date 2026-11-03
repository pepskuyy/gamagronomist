'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Calendar, BarChart3 } from 'lucide-react'
import { getDateRangeLabel } from '@/lib/date-utils'

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
  '#16824a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
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
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }} />
      Memuat statistik kegiatan...
    </div>
  )

  if (!data || data.total === 0) return (
    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><BarChart3 size={32} strokeWidth={1.5} /></div>
      <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Belum ada data kegiatan yang diinput.</p>
    </div>
  )

  const topItems = data.items
  const dateRangeLabel = getDateRangeLabel(filterQuery)

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Proporsi Semua Kegiatan</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Berdasarkan total <strong className="num">{data.total}</strong> laporan kegiatan dari user
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          fontSize: '0.78rem', fontWeight: 500,
          color: 'var(--text-secondary)', background: 'var(--surface-2)',
          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)',
          padding: '0.25rem 0.625rem', whiteSpace: 'nowrap'
        }}>
          <Calendar size={14} strokeWidth={1.75} className="icon-inline" />
          Periode: <span style={{ color: 'var(--text-main)' }}>{dateRangeLabel}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '2rem', alignItems: 'center' }}>
        {/* Left: Donut Chart */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <ChartInner items={topItems} palette={PALETTE} total={data.total} label="Kegiatan" />
        </div>

        {/* Right: Ranked list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {topItems.map((item, i) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Rank + color dot */}
              <div className="num" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0 }}>
                {i + 1}
              </div>
              {/* Name + bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span className="num" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem', flexShrink: 0 }}>{item.count}× ({item.pct}%)</span>
                </div>
                <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: PALETTE[i % PALETTE.length], borderRadius: '999px', transition: 'width 0.5s var(--ease)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
