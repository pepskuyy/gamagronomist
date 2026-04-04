'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bulkDeleteCustomerBehaviors } from '@/app/actions/cb-admin'

type CB = {
  id: string
  createdAt: string
  farmerName: string
  commodity: string | null
  user: { name: string; role: string }
}

interface Props {
  reports: CB[]
  isAdmin: boolean
  onDeleted?: () => void
  exportNode?: React.ReactNode
}

const tdStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
const thStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }
const formatDate = (d: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(d))

export default function CbReportTable({ reports, isAdmin, onDeleted, exportNode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(reports.map(r => r.id)) : new Set())
  }

  function handleBulkDelete() {
    if (!selected.size) return
    if (!confirm(`Hapus ${selected.size} data Customer Behavior yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
    start(async () => {
      setError(null)
      const res = await bulkDeleteCustomerBehaviors(Array.from(selected))
      if (res?.error) setError(res.error)
      else {
        setSelected(new Set())
        onDeleted?.()
        // Refresh the page since parent is a server component
        window.location.reload()
      }
    })
  }

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📝 Customer Behavior</h3>
        {exportNode}
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}

      {isAdmin && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selected.size} item dipilih</span>
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
                  <input type="checkbox" checked={reports.length > 0 && selected.size === reports.length} onChange={e => toggleAll(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
              )}
              <th style={thStyle}>Tanggal</th>
              <th style={thStyle}>Pembuat</th>
              <th style={thStyle}>Nama Petani</th>
              <th style={thStyle}>Komoditas</th>
              <th style={thStyle}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(rp => (
              <tr key={rp.id} style={{ background: selected.has(rp.id) ? 'var(--primary-light)' : undefined }}>
                {isAdmin && (
                  <td style={{ ...tdStyle, width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(rp.id)} onChange={() => toggle(rp.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                )}
                <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{rp.farmerName}</td>
                <td style={tdStyle}>{rp.commodity || '-'}</td>
                <td style={tdStyle}>
                  <Link href={`/dashboard/reports/cb/${rp.id}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
