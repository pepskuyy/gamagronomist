'use client'

import { useState, useEffect, useTransition } from 'react'
import { Pencil } from 'lucide-react'
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
  if (pct >= 91) return 'var(--success)'   // green-600
  if (pct >= 71) return 'var(--warning)'   // amber-600
  return 'var(--danger)'                   // red-600
}

function pctBg(pct: number): string {
  if (pct >= 91) return 'var(--success-bg)'
  if (pct >= 71) return 'var(--warning-bg)'
  return 'var(--danger-bg)'
}

function pctBadgeStyle(pct: number, target: number) {
  if (target === 0) return { color: 'var(--text-muted)', background: 'var(--surface-2)' }
  return { color: pctColor(pct), background: pctBg(pct) }
}

function KpiCard({ label, icon, desc, actual, target }: {
  label: string; icon: string; desc: string; actual: number; target: number
}) {
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0
  const barPct = Math.min(pct, 100)
  const barColor = target === 0 ? 'var(--text-muted)' : pctColor(pct)
  const badge = pctBadgeStyle(pct, target)

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.125rem' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</div>
        </div>
        {/* Percentage Badge */}
        <div className="num" style={{
          ...badge,
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '0.125rem 0.5rem',
          borderRadius: 'var(--radius-xs)',
          whiteSpace: 'nowrap',
        }}>
          {target === 0 ? '–' : `${pct}%`}
        </div>
      </div>

      {/* Big Number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span className="num" style={{
          fontSize: '2.25rem',
          fontWeight: 600,
          color: target === 0 ? 'var(--text-muted)' : 'var(--text-main)',
          lineHeight: 1.1,
        }}>
          {actual}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          aktivitas
        </span>
      </div>

      {/* Goal Label */}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Target: <strong className="num" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{target === 0 ? 'Belum diset' : target}</strong>
      </div>

      {/* Progress Bar */}
      <div>
        <div style={{
          height: '4px',
          background: 'var(--surface-2)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${barPct}%`,
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.7s var(--ease)',
          }} />
        </div>
        {/* Goal marker pct text */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <span className="num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
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
  const barColor = totalTarget === 0 ? 'var(--text-muted)' : pctColor(pct)
  
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      gridColumn: 'span 2',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Total capaian
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>Semua aktivitas bulan ini</div>
        </div>
        <div className="num" style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '0.25rem 0.625rem',
          borderRadius: 'var(--radius-xs)',
          background: totalTarget === 0 ? 'var(--surface-2)' : pctBg(pct),
          color: totalTarget === 0 ? 'var(--text-muted)' : pctColor(pct),
        }}>
          {totalTarget === 0 ? '–' : `${pct}%`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span className="num" style={{ fontSize: '2.75rem', fontWeight: 600, color: totalTarget === 0 ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: 1.1 }}>{totalActual}</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>dari <span className="num">{totalTarget}</span> aktivitas</span>
      </div>
      <div>
        <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${barPct}%`,
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.7s var(--ease)',
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
    { color: 'var(--success)', label: '≥ 91% (On Track)' },
    { color: 'var(--warning)', label: '71–90% (Warning)' },
    { color: 'var(--danger)', label: '≤ 70% (Critical)' },
  ]

  const selectStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    background: 'var(--surface)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '130px',
  }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>KPI Aktivitas Lapangan</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Capaian aktivitas vs target · Data diperbarui secara real-time
          </p>
        </div>
        <button
          onClick={() => setShowTargetForm(v => !v)}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 1rem',
            fontWeight: 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Pencil size={16} strokeWidth={1.75} className="icon-inline" />
          Set Target
        </button>
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pengguna:</span>
          <select style={selectStyle} value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
            <option value={ownerUserId}>— Total (Semua) —</option>
            {subordinates.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Bulan:</span>
          <select style={selectStyle} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Tahun:</span>
          <select style={selectStyle} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {legendItems.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Target Setting Form */}
      {showTargetForm && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
            Set Target untuk <span style={{ textDecoration: 'underline' }}>{selectedUserName}</span> · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {ACTIVITY_CARDS.map(c => (
              <div key={c.key}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {c.label}
                </label>
                <input
                  type="number"
                  min={0}
                  value={targetInputs[c.targetKey]}
                  onChange={e => setTargetInputs(prev => ({ ...prev, [c.targetKey]: Number(e.target.value) }))}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    background: 'var(--surface)',
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
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1.25rem', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? 'Menyimpan...' : 'Simpan Target'}
            </button>
            <button
              onClick={() => setShowTargetForm(false)}
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1.25rem', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '0.5rem' }}>
            Data untuk {selectedUserName} · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
        </>
      )}
    </div>
  )
}
