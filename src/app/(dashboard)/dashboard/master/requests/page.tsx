'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { approveAccountRequest, rejectAccountRequest } from '@/app/actions/register'
import { Check, X } from 'lucide-react'

type AccountRequest = {
  id: string; username: string; name: string; role: string;
  areaName: string | null; afaName: string | null; notes: string | null;
  status: string; rejectReason: string | null; createdAt: string
}

const statusBadge: Record<string, string> = {
  PENDING:  'background:var(--warning-bg);color:var(--warning);',
  APPROVED: 'background:var(--success-bg);color:var(--success);',
  REJECTED: 'background:var(--danger-bg);color:var(--danger);',
}

export default function AccountRequestsPage() {
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter,  setFilter]    = useState<'ALL'|'PENDING'|'APPROVED'|'REJECTED'>('PENDING')
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isPending, start] = useTransition()

  const fetchData = async () => {
    const res = await fetch('/api/master/account-requests')
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = requests.filter(r => filter === 'ALL' || r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  function handleApprove(id: string, name: string) {
    if (!confirm(`Setujui permintaan akun dari "${name}"?`)) return
    start(async () => {
      const res = await approveAccountRequest(id)
      if (res?.error) alert(`Gagal: ${res.error}`)
      else fetchData()
    })
  }

  function handleReject() {
    if (!rejectModal) return
    start(async () => {
      const res = await rejectAccountRequest(rejectModal, rejectReason)
      if (res?.error) alert(`Gagal: ${res.error}`)
      else { setRejectModal(null); setRejectReason(''); fetchData() }
    })
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const td: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)' }
  const th: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }

  return (
    <div>
      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-xl)', padding:'2rem', width:'100%', maxWidth:'420px', boxShadow:'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom:'1rem' }}>Alasan Penolakan</h3>
            <textarea
              className="form-control" rows={3}
              placeholder="Jelaskan alasan penolakan kepada pemohon..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ marginBottom: '1rem', resize: 'none' }}
            />
            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button onClick={handleReject} className="btn btn-danger" disabled={isPending} style={{ flex: 1 }}>
                {isPending ? 'Menolak...' : 'Tolak Permintaan'}
              </button>
              <button onClick={() => { setRejectModal(null); setRejectReason('') }} className="btn btn-outline" style={{ flex: 1 }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>← Master Data</Link>
          <div>
            <h2 style={{ margin: 0 }}>
              Permintaan Akun
              {pendingCount > 0 && (
                <span className="num" style={{ marginLeft: '0.5rem', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', verticalAlign: 'middle' }}>
                  {pendingCount}
                </span>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Setujui atau tolak permintaan pembuatan akun dari calon pengguna</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['ALL','PENDING','APPROVED','REJECTED'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={filter === s ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ padding: '0.375rem 1rem', fontSize: '0.82rem' }}>
            {s === 'ALL' ? 'Semua' : s === 'PENDING' ? `Menunggu (${pendingCount})` : s === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Nama / Username', 'Role', 'Area', 'Supervisor AFA', 'Catatan', 'Tgl. Daftar', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ background: r.status === 'PENDING' ? 'var(--warning-bg)' : 'transparent' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono-stack)' }}>@{r.username}</div>
                  </td>
                  <td style={td}>
                    <span className={`badge ${['AFA', 'PLANTATION'].includes(r.role) ? 'badge-success' : 'badge-neutral'}`}>{r.role}</span>
                  </td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{r.areaName || '-'}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{r.afaName || '-'}</td>
                  <td style={{ ...td, maxWidth: 180, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '-'}</td>
                  <td className="num" style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {new Date(r.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, ...(Object.fromEntries(statusBadge[r.status]?.split(';').filter(Boolean).map(s => s.split(':').map(s=>s.trim())) ?? [])) }}>
                      {r.status === 'PENDING' ? 'Menunggu' : r.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                    </span>
                    {r.rejectReason && <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '0.25rem' }}>{r.rejectReason}</div>}
                  </td>
                  <td style={td}>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleApprove(r.id, r.name)} disabled={isPending}
                          className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          <Check size={14} strokeWidth={1.75} className="icon-inline" /> Setuju
                        </button>
                        <button onClick={() => { setRejectModal(r.id); setRejectReason('') }} disabled={isPending}
                          className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.78rem', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                          <X size={14} strokeWidth={1.75} className="icon-inline" /> Tolak
                        </button>
                      </div>
                    )}
                    {r.status !== 'PENDING' && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                  {filter === 'PENDING' ? 'Tidak ada permintaan yang menunggu persetujuan.' : 'Tidak ada data.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
