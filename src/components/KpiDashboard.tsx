'use client'

import { useState, useEffect, useTransition } from 'react'
import { getKpiData, setKpiTarget } from '@/app/actions/kpi'

interface User {
  id: string
  username: string
  name: string
  role: string
}

interface KpiDashboardProps {
  ownerUserId: string
  subordinates: User[]
}

type Actuals = {
  demoPlot: number
  visitKios: number
  gathering: number
  company: number
  behavior: number
}

type Targets = {
  targetDemoPlot: number
  targetVisitKios: number
  targetGathering: number
  targetCompany: number
  targetBehavior: number
}

const ACTIVITY_CARDS: {
  key: keyof Actuals
  targetKey: keyof Targets
  label: string
  icon: string
  desc: string
}[] = [
  { key: 'demoPlot',  targetKey: 'targetDemoPlot',  label: 'Demo Plot',          icon: '🌱', desc: 'Jumlah demo plot yang dilakukan' },
  { key: 'visitKios', targetKey: 'targetVisitKios', label: 'Kunjungan Kios',     icon: '🏪', desc: 'Kunjungan ke kios mitra' },
  { key: 'gathering', targetKey: 'targetGathering', label: 'Farmer Gathering',   icon: '🤝', desc: 'Pertemuan kelompok tani' },
  { key: 'company',   targetKey: 'targetCompany',   label: 'Kunjungan Perusahaan',icon: '🏢', desc: 'Kunjungan perusahaan mitra' },
  { key: 'behavior',  targetKey: 'targetBehavior',  label: 'Customer Behavior',   icon: '📋', desc: 'Survey perilaku pelanggan' },
]

function pctColor(pct: number): string {
  if (pct >= 91) return '#16a34a'   // green-600
  if (pct >= 71) return '#d97706'   // amber-600
  return '#dc2626'                   // red-600
}

function pctBg(pct: number): string {
  if (pct >= 91) return '#dcfce7'
  if (pct >= 71) return '#fef3c7'
  return '#fee2e2'
}

function pctBadgeStyle(pct: number, target: number) {
  if (target === 0) return { color: '#6b7280', background: '#f3f4f6' }
  return { color: pctColor(pct), background: pctBg(pct) }
}

function KpiCard({ label, icon, desc, actual, target }: {
  label: string; icon: string; desc: string; actual: number; target: number
}) {
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0
  const barPct = Math.min(pct, 100)
  const barColor = target === 0 ? '#9ca3af' : pctColor(pct)
  const badge = pctBadgeStyle(pct, target)

  return (
    <div style={{
      background: '#fff',
      borderRadius: '0.875rem',
      border: '1px solid #e5e7eb',
      padding: '1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
            {icon} {label}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
        </div>
        {/* Percentage Badge */}
        <div style={{
          ...badge,
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '0.25rem 0.6rem',
          borderRadius: '999px',
        }}>
          {target === 0 ? '–' : `${pct}%`}
        </div>
      </div>

      {/* Big Number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: target === 0 ? '#9ca3af' : pctColor(pct),
          lineHeight: 1.1,
        }}>
          {actual}
        </span>
        <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 500 }}>
          aktivitas
        </span>
      </div>

      {/* Goal Label */}
      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
        Target: <strong style={{ color: '#374151' }}>{target === 0 ? 'Belum diset' : target}</strong>
      </div>

      {/* Progress Bar */}
      <div>
        <div style={{
          height: '6px',
          background: '#f3f4f6',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${barPct}%`,
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.7s ease',
          }} />
        </div>
        {/* Goal marker pct text */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.72rem', color: barColor, fontWeight: 600 }}>
            {target > 0 ? `${barPct}%` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// Total Overall card
function OverallCard({ actuals, targets }: { actuals: Actuals; targets: Targets }) {
  const totalActual = Object.values(actuals).reduce((a, b) => a + b, 0)
  const totalTarget = targets.targetDemoPlot + targets.targetVisitKios + targets.targetGathering + targets.targetCompany + targets.targetBehavior
  const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
  const barPct = Math.min(pct, 100)
  const barColor = totalTarget === 0 ? '#9ca3af' : pctColor(pct)
  
  return (
    <div style={{
      background: `linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)`,
      borderRadius: '0.875rem',
      border: '2px solid #bbf7d0',
      padding: '1.5rem',
      boxShadow: '0 1px 4px rgba(16,185,129,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      gridColumn: 'span 2',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Total Capaian
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>Semua aktivitas bulan ini</div>
        </div>
        <div style={{
          fontSize: '1rem',
          fontWeight: 800,
          padding: '0.35rem 0.9rem',
          borderRadius: '999px',
          background: totalTarget === 0 ? '#f3f4f6' : pctBg(pct),
          color: totalTarget === 0 ? '#9ca3af' : pctColor(pct),
        }}>
          {totalTarget === 0 ? '–' : `${pct}%`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: barColor, lineHeight: 1.1 }}>{totalActual}</span>
        <span style={{ fontSize: '1rem', color: '#6b7280' }}>dari {totalTarget} aktivitas</span>
      </div>
      <div>
        <div style={{ height: '10px', background: '#d1fae5', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${barPct}%`,
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.7s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function KpiDashboard({ ownerUserId, subordinates }: KpiDashboardProps) {
  const now = new Date()
  const [selectedUserId, setSelectedUserId] = useState(ownerUserId)
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [actuals, setActuals] = useState<Actuals>({ demoPlot: 0, visitKios: 0, gathering: 0, company: 0, behavior: 0 })
  const [targets, setTargets] = useState<Targets>({ targetDemoPlot: 0, targetVisitKios: 0, targetGathering: 0, targetCompany: 0, targetBehavior: 0 })
  const [loading, setLoading] = useState(true)
  const [showTargetForm, setShowTargetForm] = useState(false)
  const [targetInputs, setTargetInputs] = useState<Targets>({ ...targets })
  const [isPending, startTransition] = useTransition()

  const fetchData = async () => {
    setLoading(true)
    const res = await getKpiData(ownerUserId, selectedUserId, selectedMonth, selectedYear)
    setActuals(res.actuals)
    setTargets(res.targets as Targets)
    setTargetInputs(res.targets as Targets)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [selectedUserId, selectedMonth, selectedYear])

  const handleSaveTargets = () => {
    startTransition(async () => {
      await setKpiTarget({ userId: selectedUserId, month: selectedMonth, year: selectedYear, ...targetInputs })
      await fetchData()
      setShowTargetForm(false)
    })
  }

  const selectedUserName = subordinates.find(u => u.id === selectedUserId)?.name ?? 'Semua'

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  // Legend items
  const legendItems = [
    { color: '#16a34a', label: '≥ 91% (On Track)' },
    { color: '#d97706', label: '71–90% (Warning)' },
    { color: '#dc2626', label: '≤ 70% (Critical)' },
  ]

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    padding: '0.45rem 0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '130px',
  }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>📊 KPI Aktivitas Lapangan</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Capaian aktivitas vs target · Data diperbarui secara real-time
          </p>
        </div>
        <button
          onClick={() => setShowTargetForm(v => !v)}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          ✏️ Set Target
        </button>
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Pengguna:</span>
          <select style={selectStyle} value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
            <option value={ownerUserId}>— Total (Semua) —</option>
            {subordinates.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Bulan:</span>
          <select style={selectStyle} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Tahun:</span>
          <select style={selectStyle} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {legendItems.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#6b7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Target Setting Form */}
      {showTargetForm && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.875rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '1rem', color: '#065f46', fontSize: '0.9rem' }}>
            🎯 Set Target untuk <span style={{ textDecoration: 'underline' }}>{selectedUserName}</span> · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {ACTIVITY_CARDS.map(c => (
              <div key={c.key}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
                  {c.icon} {c.label}
                </label>
                <input
                  type="number"
                  min={0}
                  value={targetInputs[c.targetKey]}
                  onChange={e => setTargetInputs(prev => ({ ...prev, [c.targetKey]: Number(e.target.value) }))}
                  style={{
                    width: '100%',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSaveTargets}
              disabled={isPending}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? 'Menyimpan...' : 'Simpan Target'}
            </button>
            <button
              onClick={() => setShowTargetForm(false)}
              style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>
          Memuat data KPI...
        </div>
      ) : (
        <>
          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {/* Overall card spans full width first 2 cols */}
            <OverallCard actuals={actuals} targets={targets} />
            {ACTIVITY_CARDS.map(c => (
              <KpiCard
                key={c.key}
                label={c.label}
                icon={c.icon}
                desc={c.desc}
                actual={actuals[c.key]}
                target={targets[c.targetKey]}
              />
            ))}
          </div>

          {/* Footer note */}
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right', marginTop: '0.5rem' }}>
            Data untuk {selectedUserName} · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
        </>
      )}
    </div>
  )
}
