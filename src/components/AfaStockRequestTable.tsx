'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveAfaStockRequest, approveFamStockRequest, approveWhmStockRequest, receiveSpvStockRequest, rejectAfaStockRequest, regenerateInvoice } from '@/app/actions/afa-stock'

type RequestProps = {
  id: string
  createdAt: Date
  status: string
  plan: string | null
  foId: string
  rejectReason?: string | null
  accurateInvoiceNo?: string | null
  warehouseSource?: string | null
  fo?: { id: string; name: string } | null
  afaId?: string | null
  afa?: { id: string; name: string } | null
  details: { 
    id: string
    qtyRequested: number
    qtyApproved: number | null
    product: { id: string; name: string; unit: string }
  }[]
}

export default function AfaStockRequestTable({
  requests,
  role
}: {
  requests: RequestProps[]
  role: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  // Reject modal state
  const [rejectModalId, setRejectModalId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = (id: string) => {
    const confirmMsg = (role === 'SPV' || role === 'ADMIN')
      ? 'Apakah Anda yakin ingin menyetujui pengajuan stok ini?'
      : 'Apakah Anda yakin ingin menyetujui pengajuan stok ini?'
    if (!confirm(confirmMsg)) return
    setActionId(id)
    startTransition(async () => {
      let res
      if (role === 'SPV' || role === 'ADMIN') {
        res = await approveAfaStockRequest(id)
      } else if (role === 'FAM') {
        res = await approveFamStockRequest(id)
      } else if (role === 'WHM') {
        res = await approveWhmStockRequest(id)
      }
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleReceive = (id: string) => {
    if (!confirm('Apakah Anda yakin telah menerima stok ini? Stok akan langsung ditambahkan ke ledger AFA dan invoice Accurate akan diterbitkan.')) return
    setActionId(id)
    startTransition(async () => {
      const res = await receiveSpvStockRequest(id)
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleRegenerate = (id: string) => {
    if (!confirm('Generate ulang invoice Accurate untuk pengajuan ini? Jika ledger stok AFA belum masuk, akan diperbaiki otomatis sekarang.')) return
    setActionId(id)
    startTransition(async () => {
      const res = await regenerateInvoice(id)
      if (res?.error) {
        alert('❌ ' + res.error)
      } else {
        const msg = res.ledgerCreated
          ? `✅ Invoice ${res.invoiceNo} berhasil diterbitkan dan stok AFA sudah diperbaiki.`
          : `✅ Invoice ${res.invoiceNo} berhasil diterbitkan.`
        alert(msg)
        router.refresh()
      }
      setActionId(null)
    })
  }

  const openRejectModal = (id: string) => {
    setRejectModalId(id)
    setRejectReason('')
  }

  const closeRejectModal = () => {
    setRejectModalId(null)
    setRejectReason('')
  }

  const submitReject = () => {
    if (!rejectReason.trim()) {
      alert('Keterangan penolakan wajib diisi.')
      return
    }
    if (!rejectModalId) return
    const id = rejectModalId
    closeRejectModal()
    setActionId(id)
    startTransition(async () => {
      const rejectRoleVal = role as 'SPV' | 'FAM' | 'WHM'
      const res = await rejectAfaStockRequest(id, rejectRoleVal, rejectReason.trim())
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleDownloadPdf = async (req: RequestProps) => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('BUKTI PENERIMAAN STOK (AFA)', 14, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`ID Referensi : ${req.id.toUpperCase()}`, 14, 32)
      doc.text(`Tanggal         : ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(req.createdAt))}`, 14, 38)
      doc.text(`AFA Pemohon: ${req.fo?.name || 'Tidak diketahui'}`, 14, 44)
      doc.text(`Disetujui Oleh : ${req.afa?.name || 'SPV'}`, 14, 50)
      doc.text(`Keterangan    : ${req.plan || '-'}`, 14, 56)

      const tableBody = req.details.map((d, index) => [
        index + 1,
        d.product.name,
        d.qtyRequested,
        d.qtyApproved || d.qtyRequested,
        d.product.unit
      ])

      autoTable(doc, {
        startY: 65,
        head: [['No', 'Produk', 'Qty Diminta', 'Qty Disetujui', 'Satuan']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      })

      const finalY = (doc as any).lastAutoTable?.finalY || 65
      doc.setDrawColor('#E2E8F0')
      doc.line(14, finalY + 15, 196, finalY + 15)
      doc.text('Dokumen ini dibuat secara otomatis oleh sistem Agrolens dan sah tanpa tanda tangan fisik.', 14, finalY + 20)

      doc.save(`Bukti_Stok_${req.id.slice(0, 8).toUpperCase()}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      alert('Gagal mengunduh dokumen PDF. Silakan coba lagi.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':     return <span className="badge badge-warning">Menunggu SPV</span>
      case 'APPROVED_SPV':  return <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Menunggu FA Manager</span>
      case 'APPROVED_FAM':  return <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>Menunggu WH Manager</span>
      case 'APPROVED_WHM':  return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Menunggu Penerimaan SPV</span>
      case 'APPROVED':      return <span className="badge badge-success">Selesai</span>
      case 'REJECTED':      return <span className="badge badge-danger">Ditolak</span>
      default:              return <span className="badge badge-neutral">{status}</span>
    }
  }

  // Determine which status this role can act on (approve)
  const canApprove = (status: string) => {
    if ((role === 'SPV' || role === 'ADMIN') && status === 'SUBMITTED') return true
    if (role === 'FAM' && status === 'APPROVED_SPV') return true
    if (role === 'WHM' && status === 'APPROVED_FAM') return true
    return false
  }

  // SPV can receive stock at APPROVED_WHM
  const canReceive = (status: string) => {
    return (role === 'SPV' || role === 'ADMIN') && status === 'APPROVED_WHM'
  }

  if (requests.length === 0) return null

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

  const roleLabel: Record<string, string> = { SPV: 'dari AFA', FAM: '(FA Manager)', WHM: '(WH Manager)', AFA: 'Saya', ADMIN: '(Admin)' }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        📨 Pengajuan Stok {roleLabel[role] || ''}
      </h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>ID</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tanggal</th>
                {!['AFA', 'PLANTATION'].includes(role) && <th style={{ ...thStyle, textAlign: 'left' }}>Nama AFA</th>}
                <th style={{ ...thStyle, textAlign: 'left' }}>Produk Diminta</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Invoice</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}</td>
                  {!['AFA', 'PLANTATION'].includes(role) && <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{req.fo?.name}</td>}
                  <td style={{ ...tdStyle, fontSize: '0.82rem' }}>
                    {req.details.map(d => `${d.product.name}: ${d.qtyRequested} ${d.product.unit}`).join(', ')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {getStatusBadge(req.status)}
                    {/* Warehouse badge */}
                    {req.warehouseSource === 'SAMPLE' ? (
                      <div style={{ marginTop: '0.3rem' }}>
                        <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed', whiteSpace: 'nowrap' }}>
                          🧪 Sampel
                        </span>
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.3rem' }}>
                        <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                          🏭 Utama
                        </span>
                      </div>
                    )}
                    {/* Show rejection reason */}
                    {req.status === 'REJECTED' && req.rejectReason && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#b91c1c', fontStyle: 'italic', maxWidth: 220 }}>
                        💬 {req.rejectReason}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {req.status === 'APPROVED' && req.accurateInvoiceNo ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
                        ✅ {req.accurateInvoiceNo}
                      </span>
                    ) : req.status === 'APPROVED' && !req.accurateInvoiceNo ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                        ⚠️ Tidak Terbit
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div className="action-row" style={{ justifyContent: 'center', gap: '0.4rem' }}>
                      {canApprove(req.status) && (
                        <>
                          <button 
                            onClick={() => handleApprove(req.id)}
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            disabled={isPending && actionId === req.id}
                          >
                            {isPending && actionId === req.id ? 'Memproses...' : '✓ Approve'}
                          </button>
                          <button 
                            onClick={() => openRejectModal(req.id)}
                            className="btn" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                            disabled={isPending && actionId === req.id}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      
                      {canReceive(req.status) && (
                        <button 
                          onClick={() => handleReceive(req.id)}
                          className="btn" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                          disabled={isPending && actionId === req.id}
                        >
                          {isPending && actionId === req.id ? 'Memproses...' : '📦 Terima Stok'}
                        </button>
                      )}

                      {req.status === 'APPROVED' && (
                        <>
                          {/* Tombol Generate Invoice — muncul hanya jika belum ada invoice */}
                          {!req.accurateInvoiceNo && (role === 'SPV' || role === 'ADMIN') && (
                            <button
                              onClick={() => handleRegenerate(req.id)}
                              className="btn"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                              disabled={isPending && actionId === req.id}
                              title="Terbitkan invoice Accurate & perbaiki stok AFA"
                            >
                              {isPending && actionId === req.id ? '⏳ Proses...' : '⚡ Generate Invoice'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadPdf(req)}
                            className="btn btn-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#0ea5e9', borderColor: '#e0f2fe' }}
                          >
                            📄 Download PDF
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Reject Modal ── */}
      {rejectModalId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
        }}
          onClick={closeRejectModal}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, padding: '1.75rem', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ❌ Tolak Pengajuan
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Silakan isi keterangan alasan penolakan agar AFA mengetahui penyebab pengajuan ditolak.
            </p>

            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Keterangan Penolakan <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="input"
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Stok produk X sedang kosong di gudang..."
              style={{ width: '100%', resize: 'vertical', fontSize: '0.875rem', padding: '0.65rem 0.85rem', marginBottom: '1.25rem' }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                onClick={closeRejectModal}
                className="btn"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Batal
              </button>
              <button
                onClick={submitReject}
                className="btn"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600 }}
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

