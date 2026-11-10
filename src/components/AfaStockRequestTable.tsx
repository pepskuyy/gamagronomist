'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { approveAfaStockRequest, approveFamStockRequest, approveWhmStockRequest, receiveSpvStockRequest, rejectAfaStockRequest, regenerateInvoice, resetRequestToSubmitted } from '@/app/actions/afa-stock'
import UnitHoldBadge from './UnitHoldBadge'
import { ChevronRight, FlaskConical, Warehouse, CheckCircle2, AlertTriangle, Check, X, Zap, Package, RotateCcw, Clock, Download, XCircle } from 'lucide-react'

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

type SampleBalanceItem = {
  detailId: string
  productId: string
  productName: string
  unit: string
  available: number
  qtyRequested: number
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
  // WHM: revisi gudang Accurate per detail (detailId → nama gudang) + opsi gudang per produk
  const [whmWarehouse, setWhmWarehouse] = useState<Record<string, string>>({})
  const [warehouseOptions, setWarehouseOptions] = useState<Record<string, { name: string; qty: number }[]>>({})

  useEffect(() => {
    const req = requests.find(r => r.id === whmModalId)
    if (!req) return
    for (const d of req.details) {
      if (warehouseOptions[d.product.id]) continue
      fetch(`/api/accurate-warehouses?productId=${d.product.id}`)
        .then(r => r.json())
        .then(data => setWarehouseOptions(prev => ({ ...prev, [d.product.id]: data.warehouses ?? [] })))
        .catch(() => setWarehouseOptions(prev => ({ ...prev, [d.product.id]: [] })))
    }
  }, [whmModalId]) // eslint-disable-line react-hooks/exhaustive-deps

  // SPV Sample partial-approval modal state
  const [sampleModalId, setSampleModalId] = useState<string | null>(null)
  const [sampleBalance, setSampleBalance] = useState<Record<string, SampleBalanceItem[]>>({})
  const [loadingSampleBalance, setLoadingSampleBalance] = useState<Record<string, boolean>>({})
  // Per-item decisions: detailId → { approved, qty }
  const [sampleDecisions, setSampleDecisions] = useState<Record<string, Record<string, { approved: boolean; qty: string }>>>({})

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

  const fetchSampleBalance = useCallback(async (requestId: string) => {
    if (sampleBalance[requestId] || loadingSampleBalance[requestId]) return
    setLoadingSampleBalance(prev => ({ ...prev, [requestId]: true }))
    try {
      const res = await fetch(`/api/stock/sample-balance?requestId=${requestId}`)
      const data = await res.json()
      if (data.items) {
        setSampleBalance(prev => ({ ...prev, [requestId]: data.items }))
        // Pre-fill decisions: all approved, qty = qtyRequested
        const decisions: Record<string, { approved: boolean; qty: string }> = {}
        for (const item of data.items as SampleBalanceItem[]) {
          decisions[item.detailId] = { approved: true, qty: String(item.qtyRequested) }
        }
        setSampleDecisions(prev => ({ ...prev, [requestId]: decisions }))
      }
    } catch (err) {
      console.error('Failed to fetch sample balance:', err)
    } finally {
      setLoadingSampleBalance(prev => ({ ...prev, [requestId]: false }))
    }
  }, [sampleBalance, loadingSampleBalance])

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
      const req = requests.find(r => r.id === id)
      if (req) fetchAvailability(id)
      return
    }
    // SPV approving a SAMPLE or MAIN request → open partial approval modal
    const req = requests.find(r => r.id === id)
    if ((role === 'SPV' || role === 'ADMIN') && (req?.warehouseSource === 'SAMPLE' || req?.warehouseSource === 'MAIN')) {
      setSampleModalId(id)
      fetchSampleBalance(id)
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
            'Pengajuan disetujui FA Manager.\n\n' +
            'PERINGATAN KONFLIK STOK:\n' +
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

  const handleSampleConfirm = (requestId: string) => {
    const items = sampleBalance[requestId] ?? []
    const decisions = sampleDecisions[requestId] ?? {}

    // Validate: all approved items must have qty > 0 and not exceeding available stock
    for (const item of items) {
      const dec = decisions[item.detailId]
      if (!dec || !dec.approved) continue
      const qty = Number(dec.qty)
      if (isNaN(qty) || qty <= 0) {
        alert(`Masukkan jumlah disetujui yang valid (> 0) untuk: ${item.productName}`)
        return
      }
      if (qty > item.available) {
        alert(`Stok sampel tidak cukup untuk ${item.productName}: tersedia ${item.available} ${item.unit}, Anda input ${qty} ${item.unit}`)
        return
      }
    }

    const itemDecisions = items.map(item => {
      const dec = decisions[item.detailId]
      return {
        detailId: item.detailId,
        approved: dec?.approved ?? true,
        qtyApproved: dec?.approved ? Number(dec.qty) : 0,
      }
    })

    setSampleModalId(null)
    setActionId(requestId)
    startTransition(async () => {
      const res = await approveAfaStockRequest(requestId, itemDecisions)
      if (res?.error) {
        alert(res.error)
      } else if ((res as any)?.allRejected) {
        alert('Semua item telah ditolak. Pengajuan berstatus Ditolak.')
        router.refresh()
      } else if ((res as any)?.partialReject) {
        alert('Pengajuan disetujui sebagian. Item yang ditolak tidak akan masuk stok AFA.')
        router.refresh()
      } else {
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
      const warehouseMap = Object.fromEntries(req.details.filter(d => whmWarehouse[d.id]).map(d => [d.id, whmWarehouse[d.id]]))
      const res = await approveWhmStockRequest(requestId, qtyApprovedMap, warehouseMap)
      if (res?.error) {
        alert(res.error)
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
    if (!confirm('Generate ulang invoice Accurate untuk pengajuan ini?')) return
    setActionId(id)
    startTransition(async () => {
      const res = await regenerateInvoice(id)
      if (res?.error) {
        alert(res.error)
      } else {
        alert(`Invoice ${res.invoiceNo} berhasil diterbitkan.`)
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

  // ADMIN only: rollback request to SUBMITTED
  const handleReset = (id: string) => {
    if (!confirm('Reset pengajuan ini ke status SUBMITTED?\n\nJika pengajuan SAMPEL sudah APPROVED, entri ledger akan di-reverse otomatis.\n\nLanjutkan?')) return
    setActionId(id)
    startTransition(async () => {
      const res = await resetRequestToSubmitted(id)
      if (res?.error) {
        alert(res.error)
      } else {
        alert('Pengajuan berhasil di-reset ke SUBMITTED. SPV sekarang bisa memproses ulang.')
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
      doc.text('BUKTI PENERIMAAN STOK', 14, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`ID Referensi : ${req.id.toUpperCase()}`, 14, 32)
      doc.text(`Tanggal         : ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(req.createdAt))}`, 14, 38)
      doc.text(`Pemohon      : ${req.fo?.name || 'Tidak diketahui'}`, 14, 44)
      doc.text(`Disetujui Oleh : ${req.afa?.name || 'SPV'}`, 14, 50)

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
        
        const warehouse = d.accurateWarehouse || (req.warehouseSource !== 'SAMPLE' ? 'Gudang Baik' : '-')

        return [index + 1, d.product.name, qtyReqStr, qtyAppStr, unitKemasan, warehouse]
      })

      autoTable(doc, {
        startY: 56,
        head: [['No', 'Produk', 'Qty Diminta', 'Qty Disetujui', 'Satuan', 'Gudang']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      })

      let finalY = (doc as any).lastAutoTable?.finalY || 56

      finalY += 10
      doc.setFont('helvetica', 'bold')
      doc.text('Keterangan / Catatan:', 14, finalY)
      finalY += 6
      doc.setFont('helvetica', 'normal')
      const notes = req.plan || '-'
      const splitNotes = doc.splitTextToSize(notes, 180)
      doc.text(splitNotes, 14, finalY)

      finalY += (splitNotes.length * 5) + 10

      doc.setDrawColor('#E2E8F0')
      doc.line(14, finalY, 196, finalY)
      doc.text('Dokumen ini dibuat secara otomatis oleh sistem Agrolens dan sah tanpa tanda tangan fisik.', 14, finalY + 6)

      doc.save(`Bukti_Stok_${req.id.slice(0, 8).toUpperCase()}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      alert('Gagal mengunduh dokumen PDF. Silakan coba lagi.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':     return <span className="badge badge-warning">Menunggu SPV</span>
      case 'APPROVED_SPV':  return <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>Menunggu FA Manager</span>
      case 'APPROVED_FAM':  return <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>Menunggu WH Manager</span>
      case 'APPROVED_WHM':  return <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>Menunggu Penerimaan SPV</span>
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

  const thStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', fontVariantNumeric: 'tabular-nums' }
  const tdExpandStyle: React.CSSProperties = { padding: '0.75rem 1rem 1rem', fontSize: '0.875rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }

  const roleLabel: Record<string, string> = { SPV: 'dari AFA', FAM: '(FA Manager)', WHM: '(WH Manager)', AFA: 'Saya', ADMIN: '(Admin)' }
  const isWHM = role === 'WHM'

  // Total colspan for the expanded detail row
  const colCount = 6 + (!['AFA', 'PLANTATION'].includes(role) ? 1 : 0)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Pengajuan Stok {roleLabel[role] || ''}
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
                        <span style={{ transition: 'var(--transition)', display: 'inline-flex', transform: isExpanded ? 'rotate(90deg)' : 'none' }}><ChevronRight size={16} strokeWidth={1.75} /></span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono-stack)', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}</td>
                      {!['AFA', 'PLANTATION'].includes(role) && <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-main)' }} onClick={e => e.stopPropagation()}>{req.fo?.name}</td>}

                      {/* Produk ringkasan */}
                      <td style={{ ...tdStyle, fontSize: '0.8rem', maxWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500,
                            background: 'var(--surface-2)', color: 'var(--text-secondary)', whiteSpace: 'nowrap'
                          }}>
                            <span className="num">{req.details.length}</span> produk
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {req.details.slice(0, 2).map(d => d.product.name).join(', ')}
                            {req.details.length > 2 && ` +${req.details.length - 2} lagi`}
                          </span>
                        </div>
                      </td>

                      {/* Catatan AFA */}
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 180 }} onClick={e => e.stopPropagation()}>
                        {req.plan && req.plan !== '-' ? (
                          <span title={req.plan} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {req.plan}
                          </span>
                        ) : <span>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {getStatusBadge(req.status)}
                        {req.warehouseSource === 'SAMPLE' ? (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span style={{ padding: '0 0.375rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><FlaskConical size={12} strokeWidth={1.75} />Sampel</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span style={{ padding: '0 0.375rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Warehouse size={12} strokeWidth={1.75} />Utama</span>
                          </div>
                        )}
                        {req.status === 'REJECTED' && req.rejectReason && (
                          <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--danger)', maxWidth: 220 }}>{req.rejectReason}</div>
                        )}
                      </td>

                      {/* Invoice */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {req.warehouseSource !== 'SAMPLE' && req.accurateInvoiceNo ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: 'var(--success-bg)', color: 'var(--success)', fontFamily: 'var(--font-mono-stack)' }}>
                            <CheckCircle2 size={12} strokeWidth={1.75} />{req.accurateInvoiceNo}
                          </span>
                        ) : req.warehouseSource !== 'SAMPLE' && !req.accurateInvoiceNo && (req.status === 'APPROVED_WHM' || req.status === 'APPROVED') ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: 'var(--warning-bg)', color: 'var(--warning)' }}><AlertTriangle size={12} strokeWidth={1.75} />Tidak Terbit</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div className="action-row" style={{ justifyContent: 'center', gap: '0.5rem' }}>
                          {canApprove(req.status) && (
                            <>
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="btn btn-primary"
                                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                                disabled={isPending && actionId === req.id}
                              >
                                {isPending && actionId === req.id ? 'Memproses...' : isWHM ? <><Zap size={14} strokeWidth={1.75} className="icon-inline" />Set & Approve</> : <><Check size={14} strokeWidth={1.75} className="icon-inline" />Approve</>}
                              </button>
                              <button
                                onClick={() => openRejectModal(req.id)}
                                className="btn btn-outline"
                                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)' }}
                                disabled={isPending && actionId === req.id}
                              >
                                <X size={14} strokeWidth={1.75} className="icon-inline" />Reject
                              </button>
                            </>
                          )}

                          {canReceive(req.status) && (
                            <button
                              onClick={() => handleReceive(req.id)}
                              className="btn btn-primary"
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                              disabled={isPending && actionId === req.id}
                            >
                              {isPending && actionId === req.id ? 'Memproses...' : <><Package size={14} strokeWidth={1.75} className="icon-inline" />Terima Stok</>}
                            </button>
                          )}

                          {role === 'ADMIN' && ['APPROVED_SPV', 'APPROVED_FAM', 'APPROVED_WHM', 'APPROVED'].includes(req.status) && !(req as any).accurateInvoiceNo && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReset(req.id) }}
                              className="btn btn-outline"
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', color: 'var(--warning)' }}
                              disabled={isPending && actionId === req.id}
                              title="Reset ke SUBMITTED — hanya untuk ADMIN"
                            >
                              {isPending && actionId === req.id ? <><Clock size={14} strokeWidth={1.75} className="icon-inline" />...</> : <><RotateCcw size={14} strokeWidth={1.75} className="icon-inline" />Reset ke SPV</>}
                            </button>
                          )}

                          {req.warehouseSource !== 'SAMPLE' && !req.accurateInvoiceNo && req.status === 'APPROVED' && (role === 'SPV' || role === 'ADMIN' || role === 'WHM') && (
                            <button
                              onClick={() => handleRegenerate(req.id)}
                              className="btn btn-outline"
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', color: 'var(--warning)' }}
                              disabled={isPending && actionId === req.id}
                              title="Terbitkan ulang invoice Accurate"
                            >
                              {isPending && actionId === req.id ? <><Clock size={14} strokeWidth={1.75} className="icon-inline" />Proses...</> : <><Zap size={14} strokeWidth={1.75} className="icon-inline" />Generate Invoice</>}
                            </button>
                          )}

                          {(req.status === 'APPROVED' || (req.status === 'APPROVED_WHM' && req.warehouseSource !== 'SAMPLE')) && (
                            <button
                              onClick={() => handleDownloadPdf(req)}
                              className="btn btn-outline"
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              <Download size={14} strokeWidth={1.75} className="icon-inline" />Download PDF
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
                            <div style={{ marginBottom: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--warning)' }}>
                              <strong style={{ fontWeight: 500 }}>Catatan AFA:</strong> {req.plan}
                            </div>
                          )}

                          {/* Product detail table */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-3)' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nama Produk</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Diajukan</th>
                                {isWHM && req.status === 'APPROVED_FAM' && (
                                  <>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tersedia (Accurate)</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-main)', fontSize: '0.75rem' }}>Qty Final (WHM)</th>
                                  </>
                                )}
                                {!isWHM && (
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Disetujui</th>
                                )}
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Satuan</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Gudang Accurate</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Gramasi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.details.map((d, idx) => {
                                const avail = availItems?.find(a => a.detailId === d.id)
                                const qtyFinal = d.qtyApproved ?? d.qtyRequested
                                const hasConflict = avail && avail.availableToSell !== null && avail.availableToSell < d.qtyRequested

                                return (
                                  <tr key={d.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-light)' : undefined, background: 'var(--surface)' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{d.product.name}<UnitHoldBadge product={d.product} /></td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                      <strong className="num" style={{ fontWeight: 600 }}>{d.qtyRequested}</strong>
                                    </td>

                                    {/* WHM: show availableToSell + input */}
                                    {isWHM && req.status === 'APPROVED_FAM' && (
                                      <>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                          {isLoadingAvail ? (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} strokeWidth={1.75} />memuat...</span>
                                          ) : avail?.availableToSell !== null && avail?.availableToSell !== undefined ? (
                                            <span style={{
                                              fontWeight: 600,
                                              color: hasConflict ? 'var(--danger)' : 'var(--success)',
                                              display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap',
                                            }}>
                                              <span className="num">{avail.availableToSell}</span><span className="unit">{d.product.unit}</span>
                                              {hasConflict && <span style={{ marginLeft: '0.25rem', alignSelf: 'center', display: 'inline-flex' }}><AlertTriangle size={12} strokeWidth={1.75} /></span>}
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
                                              width: 90, padding: '0.25rem 0.5rem', fontSize: '0.875rem',
                                              border: `1px solid ${hasConflict ? 'var(--danger)' : 'var(--border)'}`,
                                              borderRadius: 'var(--radius-sm)', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                                            }}
                                          />
                                        </td>
                                      </>
                                    )}

                                    {/* Non-WHM: show approved qty */}
                                    {!isWHM && (
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                        <span className="num" style={{ fontWeight: 600, color: qtyFinal !== d.qtyRequested ? 'var(--warning)' : undefined }}>
                                          {qtyFinal}
                                          {qtyFinal !== d.qtyRequested && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>(diminta {d.qtyRequested})</span>}
                                        </span>
                                      </td>
                                    )}

                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}><span className="mono" style={{ fontSize: '0.85em' }}>{d.product.unit}</span></td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                                      {d.accurateWarehouse ? (
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Warehouse size={12} strokeWidth={1.75} />{d.accurateWarehouse}</span>
                                      ) : req.warehouseSource !== 'SAMPLE' ? (
                                        <span style={{ color: 'var(--text-muted)' }}>Gudang Baik</span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td className="num" style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
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
                            <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                              <AlertTriangle size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '0.125rem' }} />Beberapa produk memiliki stok di bawah jumlah yang diminta AFA (setelah dikurangi SO). Sesuaikan Qty Final sebelum menyetujui.
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
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
            onClick={() => setWhmModalId(null)}
          >
            <div
              className="card"
              style={{ width: '100%', maxWidth: 580, padding: '1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 600 }}>
                Konfirmasi Kuantitas Final — WH Manager
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Periksa ketersediaan stok Accurate, gudang sumber, dan tentukan kuantitas final yang akan diberikan ke AFA <strong style={{ fontWeight: 500, color: 'var(--text-main)' }}>{req.fo?.name}</strong>.
                Invoice akan dibuat otomatis berdasarkan kuantitas ini.
              </p>

              {req.plan && req.plan !== '-' && (
                <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--warning)' }}>
                  <strong style={{ fontWeight: 500 }}>Catatan AFA:</strong> {req.plan}
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Produk</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diminta</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tersedia</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-main)' }}>Qty Final</th>
                  </tr>
                </thead>
                <tbody>
                  {req.details.map((d, idx) => {
                    const avail = availItems?.find(a => a.detailId === d.id)
                    const hasConflict = avail && avail.availableToSell !== null && avail.availableToSell < d.qtyRequested
                    return (
                      <tr key={d.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-light)' : undefined }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                          {d.product.name}<UnitHoldBadge product={d.product} />
                          {req.warehouseSource !== 'SAMPLE' && (() => {
                            const current = whmWarehouse[d.id] ?? d.accurateWarehouse ?? 'Gudang Baik'
                            const opts = warehouseOptions[d.product.id] ?? []
                            const names = opts.some(o => o.name === current) ? opts : [{ name: current, qty: NaN }, ...opts]
                            return (
                              <select
                                aria-label="Gudang sumber"
                                value={current}
                                onChange={e => setWhmWarehouse(prev => ({ ...prev, [d.id]: e.target.value }))}
                                className="form-control"
                                style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.78rem', fontWeight: 400, maxWidth: 240 }}
                              >
                                {names.map(o => (
                                  <option key={o.name} value={o.name}>{o.name}{Number.isFinite(o.qty) ? ` (stok ${o.qty})` : ''}</option>
                                ))}
                              </select>
                            )
                          })()}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}><span className="num">{d.qtyRequested}</span><span className="unit">{d.product.unit}</span></td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          {isLoadingAvail ? <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}><Clock size={14} strokeWidth={1.75} /></span>
                            : avail?.availableToSell !== null && avail?.availableToSell !== undefined
                              ? <span style={{ fontWeight: 600, color: hasConflict ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'baseline' }}><span className="num">{avail.availableToSell}</span><span className="unit">{d.product.unit}</span>{hasConflict ? <span style={{ marginLeft: '0.25rem', alignSelf: 'center', display: 'inline-flex' }}><AlertTriangle size={12} strokeWidth={1.75} /></span> : ''}</span>
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
                              width: 90, padding: '0.375rem 0.5rem', fontSize: '0.875rem',
                              border: `1px solid ${hasConflict ? 'var(--danger)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius-sm)', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                              background: hasConflict ? 'var(--danger-bg)' : 'var(--surface)',
                            }}
                          />
                          <span className="unit" style={{ marginLeft: '0.375rem' }}>{d.product.unit}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setWhmModalId(null)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => handleWhmConfirm(whmModalId)}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
                  disabled={isPending && actionId === whmModalId}
                >
                  {isPending && actionId === whmModalId ? 'Memproses...' : <><Check size={16} strokeWidth={1.75} className="icon-inline" />Setujui & Post Invoice</>}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── SPV Sample Partial Approval Modal ── */}
      {sampleModalId && (() => {
        const req = requests.find(r => r.id === sampleModalId)
        if (!req) return null
        const items = sampleBalance[sampleModalId] ?? []
        const decisions = sampleDecisions[sampleModalId] ?? {}
        const isLoading = loadingSampleBalance[sampleModalId]
        const approvedCount = items.filter(item => decisions[item.detailId]?.approved !== false).length
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
            onClick={() => setSampleModalId(null)}
          >
            <div
              className="card"
              style={{ width: '100%', maxWidth: 700, padding: '1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {req.warehouseSource === 'SAMPLE' ? 'Konfirmasi Pengiriman Sampel' : 'Konfirmasi Pengajuan Stok'}
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Atur jumlah dan keputusan per item. Item yang ditolak tidak akan diproses lebih lanjut.
              </p>

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} strokeWidth={1.75} />Memuat saldo stok sampel...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Produk</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diminta</th>
                      {req.warehouseSource === 'SAMPLE' && (
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok Tersedia</th>
                      )}
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disetujui</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const dec = decisions[item.detailId] ?? { approved: true, qty: String(item.qtyRequested) }
                      const isApproved = dec.approved !== false
                      const isInsufficient = req.warehouseSource === 'SAMPLE' && item.available < item.qtyRequested
                      const inputQty = Number(dec.qty)
                      const qtyExceeds = req.warehouseSource === 'SAMPLE' && isApproved && inputQty > item.available
                      return (
                        <tr key={item.detailId} style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: !isApproved ? 'var(--danger-bg)' : isInsufficient ? 'var(--warning-bg)' : 'transparent',
                          opacity: !isApproved ? 0.7 : 1,
                          transition: 'var(--transition)',
                        }}>
                          <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>
                            {item.productName}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <span className="num">{item.qtyRequested}</span><span className="unit">{item.unit}</span>
                          </td>
                          {req.warehouseSource === 'SAMPLE' && (
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                              <span style={{
                                fontWeight: 600,
                                color: item.available >= item.qtyRequested ? 'var(--success)' : 'var(--warning)',
                                whiteSpace: 'nowrap',
                              }}>
                                <span className="num">{item.available}</span><span className="unit">{item.unit}</span>
                              </span>
                              {isInsufficient && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><AlertTriangle size={12} strokeWidth={1.75} />Kurang</div>
                              )}
                            </td>
                          )}
                          <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={1}
                              max={req.warehouseSource === 'SAMPLE' ? item.available : undefined}
                              value={dec.qty}
                              disabled={!isApproved}
                              onChange={e => setSampleDecisions(prev => ({
                                ...prev,
                                [sampleModalId]: {
                                  ...(prev[sampleModalId] ?? {}),
                                  [item.detailId]: { ...dec, qty: e.target.value }
                                }
                              }))}
                              style={{
                                width: 80, padding: '0.375rem 0.5rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                                border: `1px solid ${qtyExceeds ? 'var(--danger)' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-sm)',
                                background: !isApproved ? 'var(--surface-2)' : qtyExceeds ? 'var(--danger-bg)' : 'var(--surface)',
                                color: !isApproved ? 'var(--text-light)' : 'inherit',
                              }}
                            />
                            <span className="unit">{item.unit}</span>
                            {qtyExceeds && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.125rem' }}>Melebihi stok!</div>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => setSampleDecisions(prev => ({
                                ...prev,
                                [sampleModalId]: {
                                  ...(prev[sampleModalId] ?? {}),
                                  [item.detailId]: { approved: !isApproved, qty: !isApproved ? String(req.warehouseSource === 'SAMPLE' ? Math.min(item.qtyRequested, item.available) : item.qtyRequested) : '' }
                                }
                              }))}
                              style={{
                                padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 500, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                border: '1px solid var(--border)',
                                background: isApproved ? 'var(--success-bg)' : 'var(--danger-bg)',
                                color: isApproved ? 'var(--success)' : 'var(--danger)',
                                transition: 'var(--transition)',
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              }}
                            >
                              {isApproved ? <><CheckCircle2 size={14} strokeWidth={1.75} />Setujui</> : <><XCircle size={14} strokeWidth={1.75} />Ditolak</>}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {!isLoading && items.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong className="num" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{approvedCount}</strong> dari <strong className="num" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{items.length}</strong> item akan disetujui.
                  {approvedCount === 0 && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={14} strokeWidth={1.75} />Semua item ditolak — pengajuan akan berstatus DITOLAK.</span>}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setSampleModalId(null)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSampleConfirm(sampleModalId)}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
                  disabled={isPending && actionId === sampleModalId || isLoading}
                >
                  {isPending && actionId === sampleModalId ? 'Memproses...' : <><Check size={16} strokeWidth={1.75} className="icon-inline" />Proses Approval</>}
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
            <h3 style={{ margin: '0 0 0.375rem', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={18} strokeWidth={1.75} style={{ color: 'var(--danger)' }} />Tolak Pengajuan
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Silakan isi keterangan alasan penolakan agar AFA mengetahui penyebab pengajuan ditolak.
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Keterangan Penolakan <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Stok produk X sedang kosong di gudang..."
              style={{ width: '100%', resize: 'vertical', fontSize: '0.875rem', padding: '0.625rem 0.75rem', marginBottom: '1.25rem' }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={closeRejectModal} className="btn btn-outline" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
                Batal
              </button>
              <button
                onClick={submitReject}
                className="btn btn-danger"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
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
