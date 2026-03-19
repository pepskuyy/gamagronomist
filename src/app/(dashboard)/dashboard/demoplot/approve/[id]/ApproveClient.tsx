'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { approveRequest, rejectRequest } from '@/app/actions/approve'

type Detail = {
  id: string
  qtyRequested: number
  product: { name: string; unit: string; id: string }
}

type RequestData = {
  id: string
  fo: { name: string }
  farmer: { name: string } | null
  area: string | null
  commodity: string | null
  problem: string | null
  plan: string | null
  createdAt: string
  details: Detail[]
}

type StockEntry = { productId: string; quantity: number }

export default function ApprovePageClient({
  request,
  afaStocks,
}: {
  request: RequestData
  afaStocks: StockEntry[]
}) {
  const router = useRouter()
  const [approveStatus, setApproveStatus] = useState<'idle' | 'confirming' | 'loading' | 'done'>('idle')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getStock = (productId: string) =>
    afaStocks.find(s => s.productId === productId)?.quantity ?? 0

  async function handleApprove() {
    if (approveStatus === 'idle') {
      setApproveStatus('confirming')
      return
    }
    if (approveStatus === 'confirming') {
      setApproveStatus('loading')
      setError(null)
      const fd = new FormData()
      fd.append('requestId', request.id)
      const res = await approveRequest(fd)
      if ((res as any)?.error) {
        setError((res as any).error)
        setApproveStatus('idle')
      } else {
        setApproveStatus('done')
        setTimeout(() => router.push('/dashboard/demoplot'), 1200)
      }
    }
  }

  async function handleReject() {
    setRejectLoading(true)
    const fd = new FormData()
    fd.append('requestId', request.id)
    await rejectRequest(fd)
    router.push('/dashboard/demoplot')
  }

  const th = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', textTransform: 'uppercase' as const, color: 'var(--text-muted)', letterSpacing: '0.04em' }
  const td = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>📦 Review Pengajuan Stok dari FO</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Detail Pengajuan</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <p className="form-label" style={{ marginBottom: '0.2rem' }}>Field Officer (FO)</p>
            <p style={{ fontWeight: 600, margin: 0 }}>{request.fo.name}</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: '0.2rem' }}>Tanggal Pengajuan</p>
            <p style={{ fontWeight: 600, margin: 0 }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(request.createdAt))}</p>
          </div>
          {request.plan && request.plan !== '-' && (
            <div style={{ gridColumn: '1/-1' }}>
              <p className="form-label" style={{ marginBottom: '0.2rem' }}>Catatan FO</p>
              <p style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', margin: 0 }}>{request.plan}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Produk yang Diajukan</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={th}>Produk</th>
                <th style={th}>Diminta</th>
                <th style={th}>Stok AFA</th>
                <th style={th}>Kecukupan</th>
              </tr>
            </thead>
            <tbody>
              {request.details.map(d => {
                const stock = getStock(d.product.id)
                const enough = stock >= d.qtyRequested
                return (
                  <tr key={d.id}>
                    <td style={td}><strong>{d.product.name}</strong></td>
                    <td style={td}>{d.qtyRequested} {d.product.unit}</td>
                    <td style={td}>{stock} {d.product.unit}</td>
                    <td style={td}>
                      {enough
                        ? <span className="badge badge-success">✓ Aman</span>
                        : <span className="badge badge-danger">⚠ Kurang</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>
      )}

      {/* Confirmation prompt */}
      {approveStatus === 'confirming' && (
        <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: '#1e40af' }}>
          <strong>⚠️ Konfirmasi:</strong> Stok akan ditransfer dari akun AFA ke FO secara otomatis. Apakah kamu yakin ingin menyetujui?
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button onClick={handleApprove} className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>Ya, Setujui Sekarang</button>
            <button onClick={() => setApproveStatus('idle')} className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>Batal</button>
          </div>
        </div>
      )}

      {approveStatus === 'done' && (
        <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', fontWeight: 600, color: '#166534' }}>
          ✅ Berhasil disetujui! Mengalihkan ke halaman demoplot...
        </div>
      )}

      {approveStatus !== 'done' && approveStatus !== 'confirming' && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleReject} disabled={rejectLoading} className="btn btn-outline"
            style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            {rejectLoading ? 'Menolak...' : '❌ Tolak Pengajuan'}
          </button>
          <button onClick={handleApprove} disabled={approveStatus === 'loading'} className="btn btn-primary"
            style={{ flex: 2 }}>
            {approveStatus === 'loading' ? '⏳ Sedang Memproses...' : '✅ Setujui & Transfer Stok'}
          </button>
        </div>
      )}
    </div>
  )
}
