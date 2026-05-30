'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { approveAfaStockRequest, approveFamStockRequest, approveWhmStockRequest, receiveSpvStockRequest, rejectAfaStockRequest, regenerateInvoice } from '@/app/actions/afa-stock'

type DetailItem = {
  id: string
  qtyRequested: number
  qtyApproved: number | null
  accurateWarehouse?: string | null
  product: {
    id: string
    name: string
    unit: string
    unitGramasi: string | null
    gramasiPerUnit: number | null
  }
}

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
  details: DetailItem[]
}

type AvailabilityItem = {
  detailId: string
  productId: string
  productName: string
  unit: string
  availableToSell: number | null
  qtyRequested: number
  qtyApproved: number | null
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

  // Expanded rows state (collapsible products)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Reject modal state
  const [rejectModalId, setRejectModalId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // WHM: qty input per detail (requestId → detailId → qty)
  const [whmQty, setWhmQty] = useState<Record<string, Record<string, string>>>({})

  // WHM: stock availability per request (fetch from Accurate)
  const [availability, setAvailability] = useState<Record<string, AvailabilityItem[]>>({})
  const [loadingAvailability, setLoadingAvailability] = useState<Record<string, boolean>>({})

  // WHM modal state — show qty confirmation modal before approving
  const [whmModalId, setWhmModalId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // Fetch stock availability from Accurate when WHM expands a row at APPROVED_FAM status
  const fetchAvailability = useCallback(async (requestId: string) => {
    if (availability[requestId] || loadingAvailability[requestId]) return
    setLoadingAvailability(prev => ({ ...prev, [requestId]: true }))
    try {
      const res = await fetch(`/api/stock-availability?requestId=${requestId}`)
      const data = await res.json()
      if (data.availability) {
        setAvailability(prev => ({ ...prev, [requestId]: data.availability }))
        // Pre-fill WHM qty inputs with qtyRequested as default
        const defaultQty: Record<string, string> = {}
        for (const item of data.availability) {
          defaultQty[item.detailId] = String(item.qtyRequested)
        }
        setWhmQty(prev => ({ ...prev, [requestId]: defaultQty }))
      }
    } catch (err) {
      console.error('Failed to fetch stock availability:', err)
    } finally {
      setLoadingAvailability(prev => ({ ...prev, [requestId]: false }))
    }
  }, [availability, loadingAvailability])

  const handleRowExpand = (req: RequestProps) => {
    toggleExpand(req.id)
    // Trigger availability fetch for WHM when expanding APPROVED_FAM rows
    if (role === 'WHM' && req.status === 'APPROVED_FAM' && !expandedRows.has(req.id)) {
      fetchAvailability(req.id)
    }
  }

  const handleApprove = (id: string) => {
    if (role === 'WHM') {
      // Open WHM modal for qty confirmation
      setWhmModalId(id)
      // Ensure availability is fetched
      const req = requests.find(r => r.id === id)
      if (req) fetchAvailability(id)
      return
    }
    const confirmMsg = 'Apakah Anda yakin ingin menyetujui pengajuan stok ini?'
    if (!confirm(confirmMsg)) return
    setActionId(id)
    startTransition(async () => {
      let res
      if (role === 'SPV' || role === 'ADMIN') {
        res = await approveAfaStockRequest(id)
      } else if (role === 'FAM') {
        res = await approveFamStockRequest(id)
      }
      if (res?.error) {
        alert(res.error)
      } else {
        if (role === 'FAM' && (res as any)?.stockWarnings?.length > 0) {
          const warnings = (res as any).stockWarnings as string[]
          alert(
            '✅ Pengajuan disetujui FA Manager.\n\n' +
            '⚠️ PERINGATAN KONFLIK STOK:\n' +
            'Stok Accurate tidak mencukupi setelah memperhitungkan Sales Order yang ada:\n\n' +
            warnings.join('\n') +
            '\n\nHarap koordinasi dengan tim Sales / WH Manager sebelum melanjutkan ke tahap posting invoice.'
          )
        }
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleWhmConfirm = (requestId: string) => {
    const qtyMap = whmQty[requestId] ?? {}
    const req = requests.find(r => r.id === requestId)
    if (!req) return

    // Validate: all products must have a qty >= 0
    for (const detail of req.details) {
      const val = qtyMap[detail.id]
      if (val === undefined || val === '' || isNaN(Number(val)) || Number(val) < 0) {
        alert(`Masukkan kuantitas valid (≥ 0) untuk semua produk.`)
        return
      }
    }

    const qtyApprovedMap: Record<string, number> = {}
    for (const detail of req.details) {
      qtyApprovedMap[detail.id] = Number(qtyMap[detail.id] ?? detail.qtyRequested)
    }

    setWhmModalId(null)
    setActionId(requestId)
    startTransition(async () => {
      const res = await approveWhmStockRequest(requestId, qtyApprovedMap)
      if (res?.error) {
        alert('❌ ' + res.error)
      } else {
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleReceive = (id: string) => {
    if (!confirm('Apakah Anda yakin telah menerima stok ini? Stok akan langsung ditambahkan ke ledger AFA.')) return
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

      const tableBody = req.details.map((d, index) => {
        const qtyReq = d.qtyRequested
        const qtyApp = d.qtyApproved || d.qtyRequested
        const unitKemasan = d.product.unit
        const hasGramasi = d.product.gramasiPerUnit && d.product.unitGramasi
        const qtyReqStr = hasGramasi
          ? `${qtyReq} (${(qtyReq * d.product.gramasiPerUnit!).toLocaleString('id-ID')}${d.product.unitGramasi})`
          : String(qtyReq)
        const qtyAppStr = hasGramasi
          ? `${qtyApp} (${(qtyApp * d.product.gramasiPerUnit!).toLocaleString('id-ID')}${d.product.unitGramasi})`
          : String(qtyApp)
        return [index + 1, d.product.name, qtyReqStr, qtyAppStr, unitKemasan]
      })

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

  const canApprove = (status: string) => {
    if ((role === 'SPV' || role === 'ADMIN') && status === 'SUBMITTED') return true
    if (role === 'FAM' && status === 'APPROVED_SPV') return true
    if (role === 'WHM' && status === 'APPROVED_FAM') return true
    return false
  }

  const canReceive = (status: string) => {
    return (role === 'SPV' || role === 'ADMIN') && status === 'APPROVED_WHM'
  }

  if (requests.length === 0) return null

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }
  const tdExpandStyle: React.CSSProperties = { padding: '0.75rem 1rem 1rem', fontSize: '0.85rem', background: '#f8fafc', borderBottom: '1px solid var(--border)' }

  const roleLabel: Record<string, string> = { SPV: 'dari AFA', FAM: '(FA Manager)', WHM: '(WH Manager)', AFA: 'Saya', ADMIN: '(Admin)' }
  const isWHM = role === 'WHM'

  // Total colspan for the expanded detail row
  const colCount = 6 + (!['AFA', 'PLANTATION'].includes(role) ? 1 : 0)

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
                <th style={{ ...thStyle, width: 32 }}></th>
                <th style={{ ...thStyle, textAlign: 'left' }}>ID</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tanggal</th>
                {!['AFA', 'PLANTATION'].includes(role) && <th style={{ ...thStyle, textAlign: 'left' }}>Nama AFA</th>}
                <th style={{ ...thStyle, textAlign: 'left' }}>Produk Diminta</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Catatan AFA</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Invoice</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const isExpanded = expandedRows.has(req.id)
                const availItems = availability[req.id]
                const isLoadingAvail = loadingAvailability[req.id]
                const reqQtyMap = whmQty[req.id] ?? {}

                return (
                  <>
                    {/* ── Main row ── */}
                    <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => handleRowExpand(req)}>
                      {/* Expand toggle */}
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', width: 32, paddingRight: 0 }}>
                        <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}</td>
                      {!['AFA', 'PLANTATION'].includes(role) && <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }} onClick={e => e.stopPropagation()}>{req.fo?.name}</td>}

                      {/* Produk ringkasan */}
                      <td style={{ ...tdStyle, fontSize: '0.82rem', maxWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.15rem 0.65rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                            background: '#eff6ff', color: '#1d4ed8', whiteSpace: 'nowrap'
                          }}>
                            {req.details.length} produk
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {req.details.slice(0, 2).map(d => d.product.name).join(', ')}
                            {req.details.length > 2 && ` +${req.details.length - 2} lagi`}
                          </span>
                        </div>
                      </td>

                      {/* Catatan AFA */}
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 180, fontStyle: req.plan && req.plan !== '-' ? 'normal' : 'italic' }} onClick={e => e.stopPropagation()}>
                        {req.plan && req.plan !== '-' ? (
                          <span title={req.plan} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            💬 {req.plan}
                          </span>
                        ) : <span>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {getStatusBadge(req.status)}
                        {req.warehouseSource === 'SAMPLE' ? (
                          <div style={{ marginTop: '0.3rem' }}>
                            <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed', whiteSpace: 'nowrap' }}>🧪 Sampel</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.3rem' }}>
                            <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', whiteSpace: 'nowrap' }}>🏭 Utama</span>
                          </div>
                        )}
                        {req.status === 'REJECTED' && req.rejectReason && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#b91c1c', fontStyle: 'italic', maxWidth: 220 }}>💬 {req.rejectReason}</div>
                        )}
                      </td>

                      {/* Invoice */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {req.warehouseSource !== 'SAMPLE' && req.accurateInvoiceNo ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
                            ✅ {req.accurateInvoiceNo}
                          </span>
                        ) : req.warehouseSource !== 'SAMPLE' && !req.accurateInvoiceNo && (req.status === 'APPROVED_WHM' || req.status === 'APPROVED') ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>⚠️ Tidak Terbit</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div className="action-row" style={{ justifyContent: 'center', gap: '0.4rem' }}>
                          {canApprove(req.status) && (
                            <>
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                disabled={isPending && actionId === req.id}
                              >
                                {isPending && actionId === req.id ? 'Memproses...' : isWHM ? '⚡ Set & Approve' : '✓ Approve'}
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

                          {req.warehouseSource !== 'SAMPLE' && !req.accurateInvoiceNo && (req.status === 'APPROVED' || req.status === 'APPROVED_WHM') && (role === 'SPV' || role === 'ADMIN' || role === 'WHM') && (
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

                          {(req.status === 'APPROVED' || (req.status === 'APPROVED_WHM' && req.warehouseSource !== 'SAMPLE')) && (
                            <button
                              onClick={() => handleDownloadPdf(req)}
                              className="btn btn-outline"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#0ea5e9', borderColor: '#e0f2fe' }}
                            >
                              📄 Download PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded detail row ── */}
                    {isExpanded && (
                      <tr key={`${req.id}-detail`}>
                        <td colSpan={colCount + 3} style={tdExpandStyle}>
                          {/* Catatan AFA (full) */}
                          {req.plan && req.plan !== '-' && (
                            <div style={{ marginBottom: '0.85rem', padding: '0.6rem 0.9rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.4rem', fontSize: '0.82rem', color: '#92400e' }}>
                              <strong>💬 Catatan AFA:</strong> {req.plan}
                            </div>
                          )}

                          {/* Product detail table */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nama Produk</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Diajukan</th>
                                {isWHM && req.status === 'APPROVED_FAM' && (
                                  <>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontSize: '0.72rem', textTransform: 'uppercase' }}>Tersedia (Accurate)</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '0.72rem', textTransform: 'uppercase' }}>Qty Final (WHM)</th>
                                  </>
                                )}
                                {!isWHM && (
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Disetujui</th>
                                )}
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Satuan</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#1d4ed8', fontSize: '0.72rem', textTransform: 'uppercase' }}>Gudang Accurate</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Gramasi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.details.map((d, idx) => {
                                const avail = availItems?.find(a => a.detailId === d.id)
                                const qtyFinal = d.qtyApproved ?? d.qtyRequested
                                const hasConflict = avail && avail.availableToSell !== null && avail.availableToSell < d.qtyRequested

                                return (
                                  <tr key={d.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined, background: 'white' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{d.product.name}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                      <strong>{d.qtyRequested}</strong>
                                    </td>

                                    {/* WHM: show availableToSell + input */}
                                    {isWHM && req.status === 'APPROVED_FAM' && (
                                      <>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                          {isLoadingAvail ? (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>⏳ memuat...</span>
                                          ) : avail?.availableToSell !== null && avail?.availableToSell !== undefined ? (
                                            <span style={{
                                              fontWeight: 700,
                                              color: hasConflict ? '#dc2626' : '#059669',
                                            }}>
                                              {avail.availableToSell} {d.product.unit}
                                              {hasConflict && <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>⚠️</span>}
                                            </span>
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/A</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>
                                          <input
                                            type="number"
                                            min="0"
                                            max={d.qtyRequested}
                                            step="1"
                                            value={reqQtyMap[d.id] ?? String(d.qtyRequested)}
                                            onChange={e => setWhmQty(prev => ({
                                              ...prev,
                                              [req.id]: { ...(prev[req.id] ?? {}), [d.id]: e.target.value }
                                            }))}
                                            onClick={e => e.stopPropagation()}
                                            style={{
                                              width: 90, padding: '0.3rem 0.5rem', fontSize: '0.85rem',
                                              border: `1px solid ${hasConflict ? '#fca5a5' : 'var(--border)'}`,
                                              borderRadius: '0.35rem', textAlign: 'right', fontWeight: 600,
                                            }}
                                          />
                                        </td>
                                      </>
                                    )}

                                    {/* Non-WHM: show approved qty */}
                                    {!isWHM && (
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                        <span style={{ fontWeight: 700, color: qtyFinal !== d.qtyRequested ? '#7c3aed' : undefined }}>
                                          {qtyFinal}
                                          {qtyFinal !== d.qtyRequested && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>(diminta {d.qtyRequested})</span>}
                                        </span>
                                      </td>
                                    )}

                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{d.product.unit}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                                      {d.accurateWarehouse ? (
                                        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>🏭 {d.accurateWarehouse}</span>
                                      ) : req.warehouseSource !== 'SAMPLE' ? (
                                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Gudang Baik</span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#2563eb', fontSize: '0.8rem' }}>
                                      {d.product.gramasiPerUnit && d.product.unitGramasi
                                        ? `${(d.qtyRequested * d.product.gramasiPerUnit).toLocaleString('id-ID')}${d.product.unitGramasi}`
                                        : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>

                          {/* WHM: conflict warning summary */}
                          {isWHM && req.status === 'APPROVED_FAM' && availItems && availItems.some(a => a.availableToSell !== null && a.availableToSell < a.qtyRequested) && (
                            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.4rem', fontSize: '0.78rem', color: '#b91c1c' }}>
                              ⚠️ Beberapa produk memiliki stok di bawah jumlah yang diminta AFA (setelah dikurangi SO). Sesuaikan Qty Final sebelum menyetujui.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── WHM Qty Confirmation Modal ── */}
      {whmModalId && (() => {
        const req = requests.find(r => r.id === whmModalId)
        if (!req) return null
        const availItems = availability[whmModalId]
        const isLoadingAvail = loadingAvailability[whmModalId]
        const reqQtyMap = whmQty[whmModalId] ?? {}

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
            onClick={() => setWhmModalId(null)}
          >
            <div
              className="card"
              style={{ width: '100%', maxWidth: 580, padding: '1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700 }}>
                ⚡ Konfirmasi Kuantitas Final — WH Manager
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Periksa ketersediaan stok Accurate dan tentukan kuantitas final yang akan diberikan ke AFA <strong>{req.fo?.name}</strong>.
                Invoice akan dibuat otomatis berdasarkan kuantitas ini.
              </p>

              {req.plan && req.plan !== '-' && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.4rem', fontSize: '0.82rem', color: '#92400e' }}>
                  <strong>💬 Catatan AFA:</strong> {req.plan}
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Produk</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Diminta</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', color: '#7c3aed', textTransform: 'uppercase' }}>Tersedia</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', color: '#059669', textTransform: 'uppercase' }}>Qty Final</th>
                  </tr>
                </thead>
                <tbody>
                  {req.details.map((d, idx) => {
                    const avail = availItems?.find(a => a.detailId === d.id)
                    const hasConflict = avail && avail.availableToSell !== null && avail.availableToSell < d.qtyRequested
                    return (
                      <tr key={d.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{d.product.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{d.qtyRequested} {d.product.unit}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          {isLoadingAvail ? <span style={{ color: 'var(--text-muted)' }}>⏳</span>
                            : avail?.availableToSell !== null && avail?.availableToSell !== undefined
                              ? <span style={{ fontWeight: 700, color: hasConflict ? '#dc2626' : '#059669' }}>{avail.availableToSell} {d.product.unit}{hasConflict ? ' ⚠️' : ''}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                          }
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={reqQtyMap[d.id] ?? String(d.qtyRequested)}
                            onChange={e => setWhmQty(prev => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] ?? {}), [d.id]: e.target.value }
                            }))}
                            style={{
                              width: 90, padding: '0.35rem 0.5rem', fontSize: '0.88rem',
                              border: `1.5px solid ${hasConflict ? '#fca5a5' : '#d1fae5'}`,
                              borderRadius: '0.35rem', textAlign: 'right', fontWeight: 700,
                              background: hasConflict ? '#fff1f2' : '#f0fdf4',
                            }}
                          />
                          <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{d.product.unit}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setWhmModalId(null)}
                  className="btn"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => handleWhmConfirm(whmModalId)}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1.5rem', fontSize: '0.85rem', fontWeight: 700 }}
                  disabled={isPending && actionId === whmModalId}
                >
                  {isPending && actionId === whmModalId ? '⏳ Memproses...' : '✅ Setujui & Post Invoice'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              <button onClick={closeRejectModal} className="btn" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
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
