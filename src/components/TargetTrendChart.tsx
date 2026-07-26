'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { TrendData } from '@/app/actions/kpi-trend'

interface TargetTrendChartProps {
  areaId: string | null
  areaName: string
  allAreas: { id: string; name: string }[]
}

const ACTIVITIES = [
  { key: 'all', label: 'Semua Aktivitas' },
  { key: 'demoPlot', label: 'Demo Plot' },
  { key: 'visitKios', label: 'Kunjungan Kios' },
  { key: 'gathering', label: 'Farmer Gathering' },
  { key: 'company', label: 'Kunjungan Perusahaan' },
  { key: 'behavior', label: 'Customer Behavior' },
]

export default function TargetTrendChart({ areaId, areaName, allAreas }: TargetTrendChartProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string>(areaId ?? 'all')
  const [activityType, setActivityType] = useState<string>('all')
  const [data, setData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({
      areaId: selectedAreaId,
      activityType: activityType,
      _t: String(Date.now())
    })
    const res = await fetch(`/api/target-trend?${params.toString()}`, { cache: 'no-store' })
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [selectedAreaId, activityType])

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.65rem',
    fontSize: '0.85rem', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none',
  }

  const selectedAreaLabel =
    selectedAreaId === 'all'  ? 'Semua Area' :
    selectedAreaId === 'none' ? 'Tanpa Area' :
    allAreas.find(a => a.id === selectedAreaId)?.name ?? '?"'

  return (
    <div className="card" style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>📊 Tren Pencapaian Target</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Perbandingan target vs realisasi 6 bulan terakhir
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Area:</span>
          <select style={selectStyle} value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
            <option value="all">?" Semua Area ?"</option>
            <option value="none">Tanpa Area</option>
            {allAreas.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.id === areaId ? ' (Area saya)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Kegiatan:</span>
          <select style={selectStyle} value={activityType} onChange={e => setActivityType(e.target.value)}>
            {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>Memuat tren target...</div>
      ) : (
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
              
              <Bar dataKey="target" name="Target" fill="#bae6fd" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Line type="monotone" dataKey="actual" name="Realisasi (Aktual)" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
