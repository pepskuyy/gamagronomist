'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bulkDeleteDemoPlots } from '@/app/actions/demoplot-admin'

type DPSession = {
  id: string
  date: string
  requestId: string | null
  area: string | null
  commodity: string | null
  isFinalSession: boolean
  request: {
    fo: { name: string; role: string }
  } | null
}

interface Props {
  sessions: DPSession[]
  isAdmin: boolean
}

const tdStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
const thStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }
const fmt = (d: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(d))

export default function DemoPlotReportTable({ sessions, isAdmin }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sessions.map(s => s.id)) : new Set())
  }
  function handleBulkDelete() {
    if (!selected.size) return
    if (!confirm(`Hapus ${selected.size} sesi Demo Plot yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
    start(async () => {
      setError(null)
      const res = await bulkDeleteDemoPlots(Array.from(selected))
      if (res?.error) setError(res.error)
      else { setSelected(new Set()); window.location.reload() }
    })
  }

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🌱 Realisasi Demo Plot</h3>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}

      {isAdmin && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selected.size} sesi dipilih</span>
          <button onClick={handleBulkDelete} disabled={isPending} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
            🗑️ Hapus yang Dipilih
          </button>
          <button onClick={() => setSelected(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
        </div>
      )}

      <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-hover)' }}>
            <tr>
              {isAdmin && (
                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={sessions.length > 0 && selected.size === sessions.length} onChange={e => toggleAll(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
              )}
              <th style={thStyle}>Tanggal</th>
              <th style={thStyle}>Field Officer</th>
              <th style={thStyle}>Area</th>
              <th style={thStyle}>Komoditas</th>
              <th style={thStyle}>Status Sesi</th>
              <th style={thStyle}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} style={{ background: selected.has(s.id) ? 'var(--primary-light)' : undefined }}>
                {isAdmin && (
                  <td style={{ ...tdStyle, width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                )}
                <td style={tdStyle}>{fmt(s.date)}</td>
                <td style={tdStyle}>
                  {s.request?.fo.name ?? <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  {s.request?.fo.role && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.request.fo.role}</div>}
                </td>
                <td style={tdStyle}>{s.area || '-'}</td>
                <td style={tdStyle}>{s.commodity || '-'}</td>
                <td style={tdStyle}>
                  {s.isFinalSession
                    ? <span className="badge badge-neutral">Sesi Terakhir</span>
                    : <span className="badge badge-success">Aktif</span>}
                </td>
                <td style={tdStyle}>
                  {s.requestId
                    ? <Link href={`/dashboard/demoplot/detail/${s.requestId}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada sesi realisasi di halaman ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
