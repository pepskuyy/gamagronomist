'use client'

import { useState, useEffect, useTransition } from 'react'
import { setAreaTarget } from '@/app/actions/kpi'
import type { AreaTargetData, Targets, UserContribution } from '@/app/actions/kpi'

// ── Static config ──────────────────────────────────────────────────────────

const INDICATORS: {
  key: keyof AreaTargetData['actuals']
  targetKey: keyof Targets
  label: string
  icon: string
  desc: string
  contribKey: keyof AreaTargetData['contributions']
}[] = [
  { key: 'demoPlot',  targetKey: 'targetDemoPlot',  label: 'Demo Plot',            icon: '🌱', desc: 'Jumlah demo plot yang dilakukan',   contribKey: 'demoPlot'  },
  { key: 'visitKios', targetKey: 'targetVisitKios', label: 'Kunjungan Kios',       icon: '🏪', desc: 'Kunjungan ke kios mitra',            contribKey: 'visitKios' },
  { key: 'gathering', targetKey: 'targetGathering', label: 'Farmer Gathering',     icon: '🤝', desc: 'Pertemuan kelompok tani',            contribKey: 'gathering' },
  { key: 'company',   targetKey: 'targetCompany',   label: 'Kunjungan Perusahaan', icon: '🏢', desc: 'Kunjungan perusahaan mitra',         contribKey: 'company'   },
  { key: 'behavior',  targetKey: 'targetBehavior',  label: 'Customer Behavior',    icon: '📋', desc: 'Survey perilaku pelanggan',          contribKey: 'behavior'  },
]

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function pctColor(pct: number) { return pct >= 91 ? '#16a34a' : pct >= 71 ? '#d97706' : '#dc2626' }
function pctBg(pct: number)    { return pct >= 91 ? '#dcfce7' : pct >= 71 ? '#fef3c7' : '#fee2e2' }

// ── Sub-components ─────────────────────────────────────────────────────────

function ContribTable({ rows }: { rows: UserContribution[] }) {
  if (rows.length === 0) return (
    <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>
      Belum ada aktivitas di periode ini.
    </p>
  )
  return (
    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.6rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
        Kontribusi User
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {rows.map(r => (
          <div key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ color: '#374151' }}>
              {r.userName}
              <span style={{
                marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 700,
                color: ['AFA', 'PLANTATION'].includes(r.role) ? '#15803d' : '#1d4ed8',
                background: ['AFA', 'PLANTATION'].includes(r.role) ? '#dcfce7' : '#dbeafe',
                padding: '0.1rem 0.45rem', borderRadius: '999px',
              }}>{r.role}</span>
            </span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TargetCard({
  label, icon, desc, actual, target, contributions, canExpand,
}: {
  label: string; icon: string; desc: string
  actual: number; target: number
  contributions: UserContribution[]
  canExpand: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const pct     = target > 0 ? Math.round((actual / target) * 100) : 0
  const barPct  = Math.min(pct, 100)
  const barColor = target === 0 ? '#9ca3af' : pctColor(pct)
  const badge    = target === 0 ? { color: '#6b7280', background: '#f3f4f6' } : { color: pctColor(pct), background: pctBg(pct) }

  return (
    <div style={{
      background: '#fff', borderRadius: '0.875rem', border: '1px solid #e5e7eb',
      padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
            {icon} {label}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{desc}</div>
        </div>
        <div style={{ ...badge, fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
          {target === 0 ? '–' : `${pct}%`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ fontSize: '2.25rem', fontWeight: 800, color: target === 0 ? '#9ca3af' : barColor, lineHeight: 1.1 }}>
          {actual}
        </span>
        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>aktivitas</span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        Target: <strong style={{ color: '#374151' }}>{target === 0 ? 'Belum diset' : target}</strong>
      </div>

      <div>
        <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: '999px', transition: 'width 0.7s ease' }} />
        </div>
      </div>

      {canExpand && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, textAlign: 'left', padding: 0, marginTop: '-0.1rem' }}
        >
          {expanded ? '▲ Sembunyikan detail' : `▼ Lihat kontribusi (${contributions.length} user)`}
        </button>
      )}

      {expanded && <ContribTable rows={contributions} />}
    </div>
  )
}

function OverallCard({ actuals, targets }: { actuals: AreaTargetData['actuals']; targets: Targets }) {
  const totalActual = Object.values(actuals).reduce((a, b) => a + b, 0)
  const totalTarget = targets.targetDemoPlot + targets.targetVisitKios + targets.targetGathering + targets.targetCompany + targets.targetBehavior
  const pct    = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
  const barPct = Math.min(pct, 100)
  const barColor = totalTarget === 0 ? '#9ca3af' : pctColor(pct)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      borderRadius: '0.875rem', border: '2px solid #bbf7d0',
      padding: '1.5rem', boxShadow: '0 1px 4px rgba(16,185,129,0.1)',
      display: 'flex', flexDirection: 'column', gap: '0.75rem', gridColumn: 'span 2',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Total Capaian
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>Semua indikator periode ini</div>
        </div>
        <div style={{
          fontSize: '1rem', fontWeight: 800, padding: '0.35rem 0.9rem', borderRadius: '999px',
          background: totalTarget === 0 ? '#f3f4f6' : pctBg(pct),
          color: totalTarget === 0 ? '#9ca3af' : pctColor(pct),
        }}>
          {totalTarget === 0 ? '–' : `${pct}%`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: barColor, lineHeight: 1.1 }}>{totalActual}</span>
        <span style={{ fontSize: '1rem', color: '#6b7280' }}>dari {totalTarget === 0 ? '?' : totalTarget} aktivitas</span>
      </div>
      <div>
        <div style={{ height: '10px', background: '#d1fae5', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: '999px', transition: 'width 0.7s ease' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

type Area = { id: string; name: string }

interface TargetDashboardProps {
  isSPV: boolean
  areas: Area[]
}

const EMPTY_TARGETS: Targets = { targetDemoPlot: 0, targetVisitKios: 0, targetGathering: 0, targetCompany: 0, targetBehavior: 0 }
const EMPTY_ACTUALS = { demoPlot: 0, visitKios: 0, gathering: 0, company: 0, behavior: 0 }
const EMPTY_CONTRIBS = { demoPlot: [], visitKios: [], gathering: [], company: [], behavior: [] }

export default function TargetDashboard({ isSPV, areas }: TargetDashboardProps) {
  const now = new Date()
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all')   // 'all' | 'none' | area.id
  const [selectedMonth, setSelectedMonth]   = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear]     = useState(now.getFullYear())

  const [data, setData] = useState<AreaTargetData>({
    targets: { ...EMPTY_TARGETS },
    actuals: { ...EMPTY_ACTUALS },
    contributions: { ...EMPTY_CONTRIBS } as AreaTargetData['contributions'],
  })
  const [loading, setLoading]         = useState(true)
  const [showTargetForm, setShowTargetForm] = useState(false)
  const [targetInputs, setTargetInputs]     = useState<Targets>({ ...EMPTY_TARGETS })
  const [isPending, startTransition]        = useTransition()
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const selectedAreaLabel =
    selectedAreaId === 'all'  ? 'Semua Area' :
    selectedAreaId === 'none' ? 'Tanpa Area' :
    areas.find(a => a.id === selectedAreaId)?.name ?? '–'

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({
      areaId: selectedAreaId,
      month:  String(selectedMonth),
      year:   String(selectedYear),
      _t:     String(Date.now()), // cache buster
    })
    const res = await fetch(`/api/target-data?${params}`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      setData(json)
      setTargetInputs(json.targets)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [selectedAreaId, selectedMonth, selectedYear])

  async function handleSave() {
    setSaveMsg(null)
    const areaId = selectedAreaId === 'all' ? null : selectedAreaId === 'none' ? null : selectedAreaId
    startTransition(async () => {
      const res = await setAreaTarget({ areaId, month: selectedMonth, year: selectedYear, ...targetInputs })
      if (res.success) { setSaveMsg('Target berhasil disimpan!'); await fetchData(); setShowTargetForm(false) }
      else setSaveMsg(res.error || 'Gagal menyimpan.')
    })
  }

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.45rem 0.75rem',
    fontSize: '0.875rem', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none', minWidth: '130px',
  }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>🎯 Target Aktivitas Lapangan</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Capaian aktivitas vs target per area · Data real-time
          </p>
        </div>
        {isSPV && (
          <button
            onClick={() => setShowTargetForm(v => !v)}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ✏️ Set Target
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>Area:</span>
          <select style={selectStyle} value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
            <option value="all">— Semua Area —</option>
            <option value="none">Tanpa Area</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
          {[{ c: '#16a34a', l: '≥91% On Track' }, { c: '#d97706', l: '71–90% Warning' }, { c: '#dc2626', l: '≤70% Critical' }].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#6b7280' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: x.c, flexShrink: 0 }} />
              {x.l}
            </div>
          ))}
        </div>
      </div>

      {/* Set Target Form (SPV only, hidden when viewing 'all') */}
      {isSPV && showTargetForm && selectedAreaId !== 'all' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '1rem', color: '#065f46', fontSize: '0.9rem' }}>
            🎯 Set Target Untuk Area: <span style={{ textDecoration: 'underline' }}>{selectedAreaLabel}</span> · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          {saveMsg && <div style={{ marginBottom: '0.75rem', fontSize: '0.83rem', color: saveMsg.includes('berhasil') ? '#15803d' : '#dc2626' }}>{saveMsg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {INDICATORS.map(c => (
              <div key={c.key}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{c.icon} {c.label}</label>
                <input
                  type="number" min={0}
                  value={targetInputs[c.targetKey] === 0 ? '' : targetInputs[c.targetKey]}
                  onChange={e => setTargetInputs(prev => ({ ...prev, [c.targetKey]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  placeholder="0"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.9rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleSave} disabled={isPending}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Menyimpan...' : 'Simpan Target'}
            </button>
            <button onClick={() => setShowTargetForm(false)}
              style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              Batal
            </button>
          </div>
          {selectedAreaId === 'all' && (
            <p style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.6rem' }}>
              ⚠️ Pilih area spesifik untuk set target. "Semua Area" hanya untuk melihat agregasi.
            </p>
          )}
        </div>
      )}
      {isSPV && showTargetForm && selectedAreaId === 'all' && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#92400e' }}>
          ⚠️ Pilih area spesifik terlebih dahulu untuk menetapkan target.
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>Memuat data target...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <OverallCard actuals={data.actuals} targets={data.targets} />
            {INDICATORS.map(c => (
              <TargetCard
                key={c.key}
                label={c.label} icon={c.icon} desc={c.desc}
                actual={data.actuals[c.key]}
                target={data.targets[c.targetKey]}
                contributions={data.contributions[c.contribKey]}
                canExpand={data.contributions[c.contribKey].length > 0}
              />
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right', marginTop: '0.5rem' }}>
            {selectedAreaLabel} · {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
        </>
      )}
    </div>
  )
}
