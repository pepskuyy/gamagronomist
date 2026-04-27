'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveStockOpname, rejectStockOpname } from '@/app/actions/opname-spv'

export default function ApproveClient({ opname }: { opname: any }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  const handleApprove = () => {
    if (!confirm('Setujui penyesuaian stok ini? Saldo Ledger AFA/FO akan langsung disesuaikan berdasarkan varians yang terdata.')) return
    
    setError(null)
    startTransition(async () => {
      const res = await approveStockOpname(opname.id)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/opname/approve')
    })
  }

  const handleReject = () => {
    if (!confirm('Tolak pengajuan penyesuaian stok ini? Opname ini akan dibatalkan.')) return

    setError(null)
    startTransition(async () => {
      const res = await rejectStockOpname(opname.id)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/opname/approve')
    })
  }

  return (
    <>
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--surface-2)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Informasi Opname</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <p className="text-muted" style={{ margin: '0 0 0.2rem', fontSize: '0.875rem' }}>ID Pengajuan</p>
            <p style={{ margin: 0, fontWeight: 500, fontFamily: 'monospace' }}>{opname.id}</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: '0 0 0.2rem', fontSize: '0.875rem' }}>Waktu Disubmit</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{new Date(opname.createdAt).toLocaleString('id-ID')}</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: '0 0 0.2rem', fontSize: '0.875rem' }}>Oleh System User</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{opname.user.name} ({opname.user.role})</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: '0 0 0.2rem', fontSize: '0.875rem' }}>Status Saat Ini</p>
            <p style={{ margin: 0, fontWeight: 500 }}>
              <span className={`badge ${opname.status === 'APPROVED' ? 'badge-success' : opname.status === 'REJECTED' ? 'badge-error' : 'badge-warning'}`}>
                {opname.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        {error && <div className="alert alert-error mb-4">{error}</div>}
        
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Rincian Stok Aktual</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '2rem' }}>
          <thead style={{ background: 'var(--surface-hover)' }}>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Sistem</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Aktual</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Selisih</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '30%' }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {opname.details.map((d: any) => (
              <tr key={d.id}>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                  {d.product.name}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{d.product.code}</div>
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  {d.systemStock} {d.product.unitGramasi || d.product.unit}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  {d.physicalStock} {d.product.unitGramasi || d.product.unit}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: d.variance > 0 ? 'var(--success)' : d.variance < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {d.variance > 0 ? '+' : ''}{d.variance} {d.product.unitGramasi || d.product.unit}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontStyle: d.variance === 0 ? 'italic' : 'normal', color: d.variance === 0 ? 'var(--text-muted)' : 'inherit' }}>
                  {d.notes || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {opname.status === 'SUBMITTED' && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button onClick={handleApprove} disabled={isPending} className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }}>
              {isPending ? 'Memproses...' : 'Approve & Sesuaikan Ledger'}
            </button>
            <button onClick={handleReject} disabled={isPending} className="btn" style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {isPending ? 'Memproses...' : 'Reject Pengajuan'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
