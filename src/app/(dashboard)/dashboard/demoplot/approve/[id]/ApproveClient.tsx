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

  // Adjustable approved quantities per detail
  const [approvedQties, setApprovedQties] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    request.details.forEach(d => { map[d.id] = d.qtyRequested })
    return map
  })

  // Notes from AFA
  const [approveNotes, setApproveNotes] = useState('')

  // Reject reason
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const getStock = (productId: string) =>
    afaStocks.find(s => s.productId === productId)?.quantity ?? 0

  const handleQtyChange = (detailId: string, val: string) => {
    const num = parseFloat(val)
    setApprovedQties(prev => ({ ...prev, [detailId]: isNaN(num) ? 0 : num }))
  }

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
      fd.append('approvedQties', JSON.stringify(approvedQties))
      if (approveNotes.trim()) fd.append('approveNotes', approveNotes.trim())
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
    if (!rejectReason.trim()) {
      alert('Keterangan alasan penolakan wajib diisi.')
      return
    }
    setRejectLoading(true)
    const fd = new FormData()
    fd.append('requestId', request.id)
    fd.append('rejectReason', rejectReason.trim())
    await rejectRequest(fd)
    router.push('/dashboard/demoplot')
  }

  const th: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }
  const td: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }

  const isAnyQtyChanged = request.details.some(d => approvedQties[d.id] !== d.qtyRequested)

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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Produk yang Diajukan</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Anda dapat menyesuaikan jumlah yang disetujui untuk setiap produk. Kolom <strong>"Qty Disetujui"</strong> bisa diubah.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={th}>Produk</th>
                <th style={th}>Diminta</th>
                <th style={th}>Stok AFA</th>
                <th style={{ ...th, minWidth: 130 }}>Qty Disetujui</th>
                <th style={th}>Selisih</th>
              </tr>
            </thead>
            <tbody>
              {request.details.map(d => {
                const stock = getStock(d.product.id)
                const approved = approvedQties[d.id] ?? d.qtyRequested
                const diff = approved - d.qtyRequested
                const enough = stock >= approved
                return (
                  <tr key={d.id}>
                    <td style={td}><strong>{d.product.name}</strong></td>
                    <td style={td}>{d.qtyRequested} {d.product.unit}</td>
                    <td style={td}>
                      <span style={{ color: enough ? '#059669' : '#dc2626', fontWeight: 600 }}>{stock}</span> {d.product.unit}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="number"
                          className="input"
                          value={approved}
                          onChange={e => handleQtyChange(d.id, e.target.value)}
                          min={0}
                          step="any"
                          style={{
                            width: 90, padding: '0.4rem 0.6rem', fontSize: '0.875rem', textAlign: 'center',
                            fontWeight: 700,
                            border: diff !== 0 ? '2px solid #f59e0b' : undefined,
                          }}
                          disabled={approveStatus !== 'idle'}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.product.unit}</span>
                      </div>
                    </td>
                    <td style={td}>
                      {diff === 0 ? (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Sesuai</span>
                      ) : diff > 0 ? (
                        <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.72rem' }}>+{diff} {d.product.unit}</span>
                      ) : (
                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.72rem' }}>{diff} {d.product.unit}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AFA Notes */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
          📝 Keterangan dari AFA {isAnyQtyChanged && <span style={{ color: '#d97706' }}>(disarankan jika ada perubahan jumlah)</span>}
        </label>
        <textarea
          className="input"
          rows={3}
          value={approveNotes}
          onChange={e => setApproveNotes(e.target.value)}
          placeholder="Contoh: Stok produk A terbatas, hanya tersedia 50 ml untuk saat ini..."
          style={{ width: '100%', resize: 'vertical', fontSize: '0.875rem', padding: '0.65rem 0.85rem' }}
          disabled={approveStatus !== 'idle'}
        />
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>
      )}

      {/* Confirmation prompt */}
      {approveStatus === 'confirming' && (
        <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: '#1e40af' }}>
          <strong>⚠️ Konfirmasi:</strong> Stok akan ditransfer dari akun AFA ke FO{isAnyQtyChanged ? '. Terdapat penyesuaian jumlah dari pengajuan awal.' : ' sesuai jumlah pengajuan.'}
          {approveNotes.trim() && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>Catatan: <em>"{approveNotes.trim()}"</em></div>
          )}
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
          <button onClick={() => setRejectModalOpen(true)} disabled={rejectLoading} className="btn btn-outline"
            style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            {rejectLoading ? 'Menolak...' : '❌ Tolak Pengajuan'}
          </button>
          <button onClick={handleApprove} disabled={approveStatus === 'loading'} className="btn btn-primary"
            style={{ flex: 2 }}>
            {approveStatus === 'loading' ? '⏳ Sedang Memproses...' : '✅ Setujui & Transfer Stok'}
          </button>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
        }}
          onClick={() => setRejectModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, padding: '1.75rem', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700 }}>
              ❌ Tolak Pengajuan
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Silakan isi alasan penolakan agar FO mengetahui penyebab pengajuan ditolak.
            </p>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Keterangan Penolakan <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="input"
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Stok habis, silakan ajukan ulang minggu depan..."
              style={{ width: '100%', resize: 'vertical', fontSize: '0.875rem', padding: '0.65rem 0.85rem', marginBottom: '1.25rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setRejectModalOpen(false)} className="btn" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Batal</button>
              <button onClick={handleReject} disabled={rejectLoading} className="btn"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600 }}>
                {rejectLoading ? '⏳ ...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
