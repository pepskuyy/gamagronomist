'use client'

import { useState, useEffect } from 'react'
import type { AreaTargetData, Targets } from '@/app/actions/kpi'

interface KpiFieldDashboardProps {
  userId: string
  role: string
  areaId: string | null         // area user ini
  areaName: string              // label area
  initialMonth: number
  initialYear: number
  allAreas: { id: string; name: string }[]  // untuk dropdown filter area lain
}

const INDICATORS: { key: keyof AreaTargetData['actuals']; targetKey: keyof Targets; label: string; icon: string }[] = [
  { key: 'demoPlot',  targetKey: 'targetDemoPlot',  label: 'Demo Plot',            icon: '🌱' },
  { key: 'visitKios', targetKey: 'targetVisitKios', label: 'Kunjungan Kios',       icon: '🏪' },
  { key: 'gathering', targetKey: 'targetGathering', label: 'Farmer Gathering',     icon: '🤝' },
  { key: 'company',   targetKey: 'targetCompany',   label: 'Kunjungan Perusahaan', icon: '🏢' },
  { key: 'behavior',  targetKey: 'targetBehavior',  label: 'Customer Behavior',    icon: '📋' },
]

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function pctColor(pct: number) { return pct >= 91 ? '#16a34a' : pct >= 71 ? '#d97706' : '#dc2626' }
function pctBg(pct: number)    { return pct >= 91 ? '#dcfce7' : pct >= 71 ? '#fef3c7' : '#fee2e2' }

const EMPTY_DATA: AreaTargetData = {
  targets: { targetDemoPlot: 0, targetVisitKios: 0, targetGathering: 0, targetCompany: 0, targetBehavior: 0 },
  actuals: { demoPlot: 0, visitKios: 0, gathering: 0, company: 0, behavior: 0 },
  contributions: { demoPlot: [], visitKios: [], gathering: [], company: [], behavior: [] },
}

export default function KpiFieldDashboard({
  userId, role, areaId, areaName, initialMonth, initialYear, allAreas
}: KpiFieldDashboardProps) {
  const now   = new Date()
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  // Use own area as default; user can switch to any area
  const [selectedAreaId, setSelectedAreaId] = useState<string>(areaId ?? 'none')
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear]   = useState(initialYear)
  const [data, setData]   = useState<AreaTargetData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)

  const selectedAreaLabel =
    selectedAreaId === 'all'  ? 'Semua Area' :
    selectedAreaId === 'none' ? 'Tanpa Area' :
    allAreas.find(a => a.id === selectedAreaId)?.name ?? '–'

  async function fetchData() {
    setLoading(true)
    const res = await fetch(`/api/target-data?areaId=${selectedAreaId}&month=${month}&year=${year}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [selectedAreaId, month, year])

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.65rem',
    fontSize: '0.85rem', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none',
  }

  const totalActual = Object.values(data.actuals).reduce((a, b) => a + b, 0)
  const totalTarget = data.targets.targetDemoPlot + data.targets.targetVisitKios + data.targets.targetGathering + data.targets.targetCompany + data.targets.targetBehavior
  const totalPct = totalTarget > 0 ? Math.min(Math.round((totalActual / totalTarget) * 100), 100) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>🎯 Target Aktivitas</h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Progres capaian aktivitas vs target area · bisa pilih area lain
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Area:</span>
          <select style={selectStyle} value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
            <option value="all">— Semua Area —</option>
            <option value="none">Tanpa Area</option>
            {allAreas.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.id === areaId ? ' (Area saya)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Bulan:</span>
          <select style={selectStyle} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Tahun:</span>
          <select style={selectStyle} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: '0.9rem' }}>Memuat data target...</div>
      ) : (
        <>
          {/* Overall */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            borderRadius: '0.875rem', border: '2px solid #bbf7d0', padding: '1.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
            marginBottom: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Total Capaian — {selectedAreaLabel}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: totalTarget === 0 ? '#9ca3af' : pctColor(totalPct), lineHeight: 1 }}>{totalActual}</span>
                <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>dari {totalTarget === 0 ? '?' : totalTarget}</span>
              </div>
            </div>
            <div style={{
              fontSize: '1.25rem', fontWeight: 800, padding: '0.5rem 1.25rem', borderRadius: '999px',
              background: totalTarget === 0 ? '#f3f4f6' : pctBg(totalPct),
              color: totalTarget === 0 ? '#9ca3af' : pctColor(totalPct),
            }}>
              {totalTarget === 0 ? '–' : `${totalPct}%`}
            </div>
          </div>

          {/* Per indicator */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {INDICATORS.map(c => {
              const actual = data.actuals[c.key]
              const target = data.targets[c.targetKey]
              const pct    = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
              const color  = target === 0 ? '#9ca3af' : pctColor(pct)
              const badge  = target === 0 ? { color: '#6b7280', background: '#f3f4f6' } : { color: pctColor(pct), background: pctBg(pct) }
              return (
                <div key={c.key} style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>{c.icon} {c.label}</span>
                    <span style={{ ...badge, fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                      {target === 0 ? '–' : `${pct}%`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{actual}</span>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>/ {target === 0 ? '?' : target}</span>
                  </div>
                  <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: '999px', transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {totalTarget === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef9c3', padding: '0.65rem 1rem', borderRadius: '0.5rem', margin: 0 }}>
              ⚠️ SPV belum menetapkan target untuk area <strong>{selectedAreaLabel}</strong> di periode ini.
            </p>
          )}
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right', marginTop: '0.5rem' }}>
            {selectedAreaLabel} · {MONTHS[month - 1]} {year}
          </div>
        </>
      )}
    </div>
  )
}
