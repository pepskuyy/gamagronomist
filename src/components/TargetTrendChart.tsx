'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { TrendData } from '@/app/actions/kpi-trend'

interface TargetTrendChartProps {
  areaId: string | null
  areaName: string
  allAreas: { id: string; name: string }[]
}

const ACTIVITIES = [
  { key: 'all',       label: 'Semua Aktivitas' },
  { key: 'demoPlot',  label: 'Demo Plot' },
  { key: 'visitKios', label: 'Kunjungan Kios' },
  { key: 'gathering', label: 'Farmer Gathering' },
  { key: 'company',   label: 'Kunjungan Perusahaan' },
  { key: 'behavior',  label: 'Customer Behavior' },
]

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function defaultRange() {
  const now = new Date()
  const toMonth = now.getMonth() + 1
  const toYear  = now.getFullYear()
  let fromMonth = toMonth - 5
  let fromYear  = toYear
  if (fromMonth <= 0) { fromMonth += 12; fromYear -= 1 }
  return { fromMonth, fromYear, toMonth, toYear }
}

function monthDiff(fm: number, fy: number, tm: number, ty: number) {
  return (ty - fy) * 12 + (tm - fm)
}

// Generate list of {month, year} options for N years back/forward from current
function buildMonthOptions(currentYear: number) {
  const options: { month: number; year: number; label: string }[] = []
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      options.push({ month: m, year: y, label: `${MONTH_NAMES[m - 1]} ${y}` })
    }
  }
  return options
}

export default function TargetTrendChart({ areaId, areaName, allAreas }: TargetTrendChartProps) {
  const def = defaultRange()
  const now = new Date()
  const currentYear = now.getFullYear()
  const monthOptions = buildMonthOptions(currentYear)

  const [selectedAreaId, setSelectedAreaId] = useState<string>(areaId ?? 'all')
  const [activityType,   setActivityType]   = useState<string>('all')
  const [fromMonth, setFromMonth] = useState(def.fromMonth)
  const [fromYear,  setFromYear]  = useState(def.fromYear)
  const [toMonth,   setToMonth]   = useState(def.toMonth)
  const [toYear,    setToYear]    = useState(def.toYear)
  const [data,      setData]      = useState<TrendData[]>([])
  const [loading,   setLoading]   = useState(true)
  const [rangeError, setRangeError] = useState<string | null>(null)

  const validate = useCallback(() => {
    const diff = monthDiff(fromMonth, fromYear, toMonth, toYear)
    if (diff < 0)  return 'Bulan awal tidak boleh setelah bulan akhir.'
    if (diff > 11) return 'Maksimal rentang 12 bulan.'
    return null
  }, [fromMonth, fromYear, toMonth, toYear])

  async function fetchData() {
    const err = validate()
    if (err) { setRangeError(err); return }
    setRangeError(null)
    setLoading(true)
    const params = new URLSearchParams({
      areaId: selectedAreaId,
      activityType,
      fromMonth: String(fromMonth),
      fromYear:  String(fromYear),
      toMonth:   String(toMonth),
      toYear:    String(toYear),
      _t: String(Date.now()),
    })
    const res = await fetch(`/api/target-trend?${params.toString()}`, { cache: 'no-store' })
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [selectedAreaId, activityType, fromMonth, fromYear, toMonth, toYear])

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.65rem',
    fontSize: '0.85rem', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none',
  }

  const rangeLabel = `${MONTH_NAMES[fromMonth - 1]} ${fromYear} — ${MONTH_NAMES[toMonth - 1]} ${toYear}`
  const fromValue = `${fromYear}-${String(fromMonth).padStart(2,'0')}`
  const toValue   = `${toYear}-${String(toMonth).padStart(2,'0')}`

  function handleFrom(val: string) {
    const [y, m] = val.split('-').map(Number)
    setFromMonth(m); setFromYear(y)
  }

  function handleTo(val: string) {
    const [y, m] = val.split('-').map(Number)
    setToMonth(m); setToYear(y)
  }

  return (
    <div className="card" style={{ marginBottom: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>📊 Tren Pencapaian Target</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {rangeLabel}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Area:</span>
          <select style={selectStyle} value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
            <option value="all">Semua Area</option>
            <option value="none">Tanpa Area</option>
            {allAreas.map(a => (
              <option key={a.id} value={a.id}>{a.name}{a.id === areaId ? ' (Area saya)' : ''}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Kegiatan:</span>
          <select style={selectStyle} value={activityType} onChange={e => setActivityType(e.target.value)}>
            {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Dari:</span>
          <select style={selectStyle} value={fromValue} onChange={e => handleFrom(e.target.value)}>
            {monthOptions.map(o => {
              const v = `${o.year}-${String(o.month).padStart(2,'0')}`
              return <option key={v} value={v}>{o.label}</option>
            })}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Sampai:</span>
          <select style={selectStyle} value={toValue} onChange={e => handleTo(e.target.value)}>
            {monthOptions.map(o => {
              const v = `${o.year}-${String(o.month).padStart(2,'0')}`
              return <option key={v} value={v}>{o.label}</option>
            })}
          </select>
        </div>
      </div>

      {rangeError && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
          ⚠️ {rangeError}
        </div>
      )}

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
                contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                cursor={{ fill: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
              <Bar dataKey="target" name="Target" fill="#bae6fd" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Line type="monotone" dataKey="actual" name="Realisasi (Aktual)" stroke="#0ea5e9" strokeWidth={3}
                dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

