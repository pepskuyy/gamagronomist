'use client'

import { useState, useEffect } from 'react'
import { getKpiDataForFieldUser } from '@/app/actions/kpi'

interface KpiFieldDashboardProps {
  userId: string
  role: string
  initialMonth: number
  initialYear: number
}

type Actuals = { demoPlot: number; visitKios: number; gathering: number; company: number; behavior: number }
type Targets = { targetDemoPlot: number; targetVisitKios: number; targetGathering: number; targetCompany: number; targetBehavior: number }

const ACTIVITY_CARDS: { key: keyof Actuals; targetKey: keyof Targets; label: string; icon: string; desc: string }[] = [
  { key: 'demoPlot',  targetKey: 'targetDemoPlot',  label: 'Demo Plot',            icon: '🌱', desc: 'Jumlah demo plot yang dilakukan' },
  { key: 'visitKios', targetKey: 'targetVisitKios', label: 'Kunjungan Kios',       icon: '🏪', desc: 'Kunjungan ke kios mitra' },
  { key: 'gathering', targetKey: 'targetGathering', label: 'Farmer Gathering',     icon: '🤝', desc: 'Pertemuan kelompok tani' },
  { key: 'company',   targetKey: 'targetCompany',   label: 'Kunjungan Perusahaan', icon: '🏢', desc: 'Kunjungan perusahaan mitra' },
  { key: 'behavior',  targetKey: 'targetBehavior',  label: 'Customer Behavior',    icon: '📋', desc: 'Survey perilaku pelanggan' },
]

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function pctColor(pct: number) {
  if (pct >= 91) return '#16a34a'
  if (pct >= 71) return '#d97706'
  return '#dc2626'
}
function pctBg(pct: number) {
  if (pct >= 91) return '#dcfce7'
  if (pct >= 71) return '#fef3c7'
  return '#fee2e2'
}

function KpiCard({ label, icon, desc, actual, target }: { label: string; icon: string; desc: string; actual: number; target: number }) {
  const pct     = target > 0 ? Math.round((actual / target) * 100) : 0
  const barPct  = Math.min(pct, 100)
  const color   = target === 0 ? '#9ca3af' : pctColor(pct)
  const bg      = target === 0 ? { color: '#6b7280', background: '#f3f4f6' } : { color: pctColor(pct), background: pctBg(pct) }

  return (
    <div style={{ background: '#fff', borderRadius: '0.875rem', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{icon} {label}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
        </div>
        <div style={{ ...bg, fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px' }}>
          {target === 0 ? '–' : `${pct}%`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 800, color, lineHeight: 1.1 }}>{actual}</span>
        <span style={{ fontSize: '1rem', color: '#9ca3af' }}>aktivitas</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
        Target: <strong style={{ color: '#374151' }}>{target === 0 ? 'Belum diset' : target}</strong>
      </div>
      <div>
        <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: '999px', transition: 'width 0.7s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.72rem', color, fontWeight: 600 }}>{target > 0 ? `${barPct}%` : ''}</span>
        </div>
      </div>
    </div>
  )
}

function OverallCard({ actuals, targets }: { actuals: Actuals; targets: Targets }) {
  const totalActual = Object.values(actuals).reduce((a, b) => a + b, 0)
  const totalTarget = targets.targetDemoPlot + targets.targetVisitKios + targets.targetGathering + targets.targetCompany + targets.targetBehavior
  const pct    = totalTarget > 0 ? Math.min(Math.round((totalActual / totalTarget) * 100), 100) : 0
  const color  = totalTarget === 0 ? '#9ca3af' : pctColor(pct)

  return (
    <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '0.875rem', border: '2px solid #bbf7d0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Total Capaian</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>Semua aktivitas bulan ini</div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, padding: '0.35rem 0.9rem', borderRadius: '999px', background: totalTarget === 0 ? '#f3f4f6' : pctBg(pct), color: totalTarget === 0 ? '#9ca3af' : pctColor(pct) }}>
          {totalTarget === 0 ? '–' : `${pct}%`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '3rem', fontWeight: 900, color, lineHeight: 1.1 }}>{totalActual}</span>
        <span style={{ fontSize: '1rem', color: '#6b7280' }}>dari {totalTarget} aktivitas</span>
      </div>
      <div style={{ height: '10px', background: '#d1fae5', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '999px', transition: 'width 0.7s ease' }} />
      </div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color }}>
        {totalTarget === 0 ? '⚠️ SPV belum menetapkan target untuk periode ini' : pct >= 100 ? '✅ Target Tercapai!' : pct >= 71 ? '⚡ Mendekati Target' : '🔴 Perlu Perhatian'}
      </div>
    </div>
  )
}

export default function KpiFieldDashboard({ userId, role, initialMonth, initialYear }: KpiFieldDashboardProps) {
  const now = new Date()
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const [month, setMonth]   = useState(initialMonth)
  const [year, setYear]     = useState(initialYear)
  const [loading, setLoading] = useState(false)
  const [actuals, setActuals] = useState<Actuals>({ demoPlot: 0, visitKios: 0, gathering: 0, company: 0, behavior: 0 })
  const [targets, setTargets] = useState<Targets>({ targetDemoPlot: 0, targetVisitKios: 0, targetGathering: 0, targetCompany: 0, targetBehavior: 0 })
  const [hasTarget, setHasTarget] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const res = await getKpiDataForFieldUser(userId, role, month, year)
    setActuals(res.actuals)
    setTargets(res.targets as Targets)
    setHasTarget(res.hasTarget)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [month, year])

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    padding: '0.45rem 0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  }

  const legendItems = [
    { color: '#16a34a', label: '≥ 91%' },
    { color: '#d97706', label: '71–90%' },
    { color: '#dc2626', label: '≤ 70%' },
  ]

  return (
    <div>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>📊 KPI Capaian Aktivitas Bulan Ini</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {hasTarget ? `Target ditetapkan oleh SPV · Capaian pribadi ${role}` : 'SPV belum menetapkan target untuk periode ini.'}
          </p>
        </div>
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Bulan:</span>
          <select style={selectStyle} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Tahun:</span>
          <select style={selectStyle} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {legendItems.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#6b7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>Memuat data KPI...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <OverallCard actuals={actuals} targets={targets} />
            {ACTIVITY_CARDS.map(c => (
              <KpiCard key={c.key} label={c.label} icon={c.icon} desc={c.desc} actual={actuals[c.key]} target={targets[c.targetKey]} />
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right' }}>
            Capaian Anda · {MONTHS[month - 1]} {year}
          </div>
        </>
      )}
    </div>
  )
}
