'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Warehouse, FlaskConical, Clock, Plus, ClipboardList, FileText, Download, ArrowLeft } from 'lucide-react'

type SampleProduct = {
  productId:      string
  productName:    string
  unit:           string
  unitGramasi:    string | null
  gramasiPerUnit: number | null
  balance:        number
}
type MainProduct = {
  id:             string
  name:           string
  unit:           string
  unitGramasi?:   string | null
  gramasiPerUnit?:number | null
  spvStock?:      number | null  // stok SPV dari Accurate (dalam kemasan)
}
type SelectedProduct = {
  productId:        string
  qtyRequested:     number
  name:             string
  unit:             string
  unitGramasi?:     string | null
  gramasiPerUnit?:  number | null
  spvStock?:        number | null
  accurateWarehouse?: string | null  // hanya untuk MAIN mode
}
type BdCustomer = {
  id: number
  customerNo?: string
  name: string
  defaultSalesman?: { name?: string } | null
}
type Request = {
  id: string
  createdAt: string
  status: string
  plan: string
  warehouseSource?: string | null
  details: { product: { name: string }; qtyRequested: number; qtyApproved: number | null; requestUnit: string }[]
}

export default function BdStockRequestPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  // ── Mode selection ─────────────────────────────────────────────────
  // 'SAMPLE' = gudang sampel SPV (flow lama)
  // 'MAIN'   = gudang utama (flow baru, approval penuh SPV → FAM → WHM)
  const [requestMode, setRequestMode] = useState<'SAMPLE' | 'MAIN'>('SAMPLE')

  // ── SAMPLE mode state ──────────────────────────────────────────────
  const [sampleProducts, setSampleProducts]     = useState<SampleProduct[]>([])
  const [loadingSample, setLoadingSample]       = useState(true)
  const [customers, setCustomers]               = useState<BdCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [destinationCustomer, setDestinationCustomer] = useState('')

  // ── MAIN mode state ────────────────────────────────────────────────
  const [mainProducts, setMainProducts]         = useState<MainProduct[]>([])
  const [loadingMain, setLoadingMain]           = useState(false)
  const [warehouseOptions, setWarehouseOptions] = useState<Record<string, { name: string; qty: number }[]>>({})
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({})
  const [loadingWarehouses, setLoadingWarehouses]   = useState<Record<string, boolean>>({})

  // ── Shared state ───────────────────────────────────────────────────
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]     = useState('')
  const [currentQty, setCurrentQty]             = useState('')
  const [notes, setNotes]                       = useState('')
  const [error, setError]                       = useState<string | null>(null)
  const [isPending, startTransition]            = useTransition()

  // ── History state ──────────────────────────────────────────────────
  const [requests, setRequests]       = useState<Request[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)

  // Initial data fetch
  useEffect(() => {
    fetch('/api/sample-stock-for-afa')
      .then(r => r.json())
      .then(data => { setSampleProducts(Array.isArray(data) ? data : []); setLoadingSample(false) })
      .catch(() => setLoadingSample(false))

    fetch('/api/bd-customers')
      .then(r => r.json())
      .then(data => { setCustomers(data.customers ?? []); setLoadingCustomers(false) })
      .catch(() => setLoadingCustomers(false))

    fetch('/api/bd-requests')
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoadingReqs(false) })
      .catch(() => setLoadingReqs(false))
  }, [])

  // Fetch main warehouse products when mode switches to MAIN
  useEffect(() => {
    if (requestMode !== 'MAIN' || mainProducts.length > 0) return
    setLoadingMain(true)
    fetch('/api/spv-stock')
      .then(r => r.json())
      .then(data => { setMainProducts(data.products ?? []) })
      .catch(() => {})
      .finally(() => setLoadingMain(false))
  }, [requestMode])

  // Clear products when mode changes
  useEffect(() => {
    setSelectedProducts([])
    setCurrentProduct('')
    setCurrentQty('')
    setSelectedWarehouses({})
    setError(null)
  }, [requestMode])

  // Fetch warehouses when MAIN product is selected
  useEffect(() => {
    if (requestMode !== 'MAIN' || !currentProduct) return
    if (warehouseOptions[currentProduct]) return  // cached
    setLoadingWarehouses(prev => ({ ...prev, [currentProduct]: true }))
    fetch(`/api/accurate-warehouses?productId=${currentProduct}`)
      .then(r => r.json())
      .then(data => {
        const whs = data.warehouses ?? [{ name: 'Gudang Baik', qty: 0 }]
        setWarehouseOptions(prev => ({ ...prev, [currentProduct]: whs }))
        if (whs.length > 0 && !selectedWarehouses[currentProduct]) {
          setSelectedWarehouses(prev => ({ ...prev, [currentProduct]: whs[0].name }))
        }
      })
      .catch(() => {
        setWarehouseOptions(prev => ({ ...prev, [currentProduct]: [{ name: 'Gudang Baik', qty: 0 }] }))
        setSelectedWarehouses(prev => ({ ...prev, [currentProduct]: 'Gudang Baik' }))
      })
      .finally(() => setLoadingWarehouses(prev => ({ ...prev, [currentProduct]: false })))
  }, [currentProduct, requestMode])

  const sampleDetail = sampleProducts.find(s => s.productId === currentProduct)
  const mainDetail   = mainProducts.find(p => p.id === currentProduct)
  const currentSampleBalance = sampleDetail?.balance ?? null

  function addProduct() {
    const qty = Number(currentQty)
    if (!currentProduct || qty <= 0) return
    if (!Number.isInteger(qty)) {
      alert('Pengajuan ke SPV harus dalam satuan kemasan utuh (bilangan bulat).'); return
    }
    if (selectedProducts.find(p => p.productId === currentProduct)) {
      alert('Produk ini sudah ada dalam daftar.'); return
    }

    if (requestMode === 'SAMPLE') {
      const sampleP = sampleProducts.find(s => s.productId === currentProduct)
      if (!sampleP) return
      if (sampleP.balance <= 0) {
        alert('Produk ini tidak tersedia di gudang sampel SPV.'); return
      }
      setSelectedProducts(prev => [...prev, {
        productId: sampleP.productId, qtyRequested: qty, name: sampleP.productName,
        unit: sampleP.unit, unitGramasi: sampleP.unitGramasi,
        gramasiPerUnit: sampleP.gramasiPerUnit, spvStock: sampleP.balance,
      }])
    } else {
      // MAIN mode
      const mainP = mainProducts.find(p => p.id === currentProduct)
      if (!mainP) return
      if (mainP.spvStock != null && qty > mainP.spvStock) {
        alert(`Jumlah melebihi stok SPV! Tersedia: ${mainP.spvStock} ${mainP.unit}`); return
      }
      setSelectedProducts(prev => [...prev, {
        productId:         mainP.id,
        qtyRequested:      qty,
        name:              mainP.name,
        unit:              mainP.unit,
        unitGramasi:       mainP.unitGramasi,
        gramasiPerUnit:    mainP.gramasiPerUnit,
        spvStock:          mainP.spvStock,
        accurateWarehouse: selectedWarehouses[mainP.id] ?? null,
      }])
    }
    setCurrentProduct(''); setCurrentQty('')
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    if (selectedProducts.length === 0) { setError('Masukkan minimal satu produk.'); return }
    if (!destinationCustomer) { setError('Pilih tujuan pengiriman pelanggan.'); return }

    const payload = selectedProducts.map(p => ({
      productId:         p.productId,
      qtyRequested:      p.qtyRequested,
      accurateWarehouse: p.accurateWarehouse ?? null,
    }))

    // Prepend customer name to notes for both modes
    const customerObj  = customers.find(c => c.id.toString() === destinationCustomer)
    const customerName = customerObj ? customerObj.name : '-'
    const finalNotes   = `Tujuan Pengiriman: ${customerName}\n\n${notes || '-'}`

    const formData = new FormData()
    formData.append('notes',           finalNotes)
    formData.append('products',        JSON.stringify(payload))
    formData.append('warehouseSource', requestMode)  // 'SAMPLE' or 'MAIN'

    startTransition(async () => {
      const res = await submitAfaStockRequest(formData)
      if (res?.error) setError(res.error)
      else {
        // Produk tanpa isi per kemasan: pengajuan tersimpan, tapi stoknya tertahan sampai admin melengkapi
        if (res && 'warning' in res && res.warning) alert(res.warning)
        setSelectedProducts([]); setCurrentProduct(''); setCurrentQty('')
        setNotes(''); setDestinationCustomer(''); setError(null)
        fetch('/api/bd-requests').then(r => r.json()).then(data => setRequests(Array.isArray(data) ? data : []))
        setActiveTab('history')
      }
    })
  }

  function getStatusBadge(status: string, warehouseSource?: string | null) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      SUBMITTED:       { label: 'Menunggu SPV',       color: 'var(--warning)', bg: 'var(--warning-bg)' },
      APPROVED_SPV:    { label: 'Disetujui SPV',       color: 'var(--info)', bg: 'var(--info-bg)' },
      APPROVED_FAM:    { label: 'Disetujui FA Manager',color: 'var(--info)', bg: 'var(--info-bg)' },
      APPROVED_WHM:    { label: 'Disetujui WH Manager',color: 'var(--info)', bg: 'var(--info-bg)' },
      APPROVED:        { label: 'Selesai',              color: 'var(--success)', bg: 'var(--success-bg)' },
      REJECTED:        { label: 'Ditolak',              color: 'var(--danger)', bg: 'var(--danger-bg)' },
    }
    const s = map[status] ?? { label: status, color: 'var(--text-muted)', bg: 'var(--surface-2)' }
    return (
      <span style={{ padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    )
  }

  const handleDownloadPdf = async (req: any) => {
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

      const tableBody = (req.details || []).map((d: any, index: number) => {
        const qtyReq = d.qtyRequested
        const qtyApp = d.qtyApproved || d.qtyRequested
        const unitKemasan = d.product?.unit || d.requestUnit || ''
        const hasGramasi = d.product?.gramasiPerUnit && d.product?.unitGramasi
        const qtyReqStr = hasGramasi
          ? `${qtyReq} (${(qtyReq * d.product.gramasiPerUnit).toLocaleString('id-ID')}${d.product.unitGramasi})`
          : String(qtyReq)
        const qtyAppStr = hasGramasi
          ? `${qtyApp} (${(qtyApp * d.product.gramasiPerUnit).toLocaleString('id-ID')}${d.product.unitGramasi})`
          : String(qtyApp)
        
        const warehouse = d.accurateWarehouse || (req.warehouseSource !== 'SAMPLE' ? 'Gudang Baik' : '-')

        return [index + 1, d.product?.name || '-', qtyReqStr, qtyAppStr, unitKemasan, warehouse]
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

      finalY += 6
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text('Dokumen ini digenerate secara otomatis oleh sistem.', 14, finalY)

      doc.save(`Stok_${req.id.slice(0, 8).toUpperCase()}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Gagal mendownload PDF. Pastikan koneksi internet stabil.')
    }
  }

  const thStyle: React.CSSProperties = { padding: '0.625rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }

  const currentProductOptions = requestMode === 'SAMPLE'
    ? sampleProducts.map(p => ({
        value: p.productId,
        label: p.gramasiPerUnit && p.unitGramasi
          ? `${p.productName} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit} • Stok sampel: ${p.balance} ${p.unit}`
          : `${p.productName} (${p.unit}) • Stok sampel: ${p.balance} ${p.unit}`,
      }))
    : mainProducts.map(p => ({
        value: p.id,
        label: p.gramasiPerUnit && p.unitGramasi
          ? `${p.name} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit}${p.spvStock != null ? ` • Stok SPV: ${p.spvStock} ${p.unit}` : ''}`
          : `${p.name} (${p.unit})${p.spvStock != null ? ` • Stok SPV: ${p.spvStock} ${p.unit}` : ''}`,
      }))

  const currentUnit = requestMode === 'SAMPLE' ? (sampleDetail?.unit || 'kemasan') : (mainDetail?.unit || 'kemasan')

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><ArrowLeft size={16} strokeWidth={1.75} className="icon-inline" />Dashboard</Link>
        <div>
          <h2 style={{ margin: 0 }}>Stok BD</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pengajuan stok Busdev & riwayat permintaan.
          </p>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        {[
          { key: 'form',    label: 'Ajukan Stok Baru' },
          { key: 'history', label: 'Riwayat Pengajuan' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.625rem 1.25rem', fontWeight: 500, fontSize: '0.875rem', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
              marginBottom: '-1px', transition: 'var(--transition)',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >{tab.key === 'form' ? <Plus size={16} strokeWidth={1.75} /> : <ClipboardList size={16} strokeWidth={1.75} />}{tab.label}</button>
        ))}
      </div>

      {/* ─── TAB FORM ─── */}
      {activeTab === 'form' && (
        <div>
          {/* Mode selector */}
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <p style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>Ajukan dari Gudang:</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {([
                ['SAMPLE', 'Gudang Sampel SPV', 'Approval 1 langkah oleh SPV. Untuk kebutuhan sampel & demo.', 'var(--primary-light)', 'var(--primary)'],
                ['MAIN',   'Gudang Utama (Accurate)', 'Approval penuh: SPV → FA Manager → WH Manager. Stok dari gudang Accurate.', 'var(--primary-light)', 'var(--primary)'],
              ] as const).map(([val, label, desc, bg, color]) => (
                <label key={val} onClick={() => setRequestMode(val)}
                  style={{
                    flex: 1, minWidth: 200, cursor: 'pointer', padding: '0.75rem 1rem',
                    border: `1px solid ${requestMode === val ? color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', background: requestMode === val ? bg : 'var(--surface)',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input type="radio" name="requestMode" value={val} checked={requestMode === val} onChange={() => setRequestMode(val)} />
                    <span style={{ fontWeight: 500, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>{val === 'MAIN' ? <Warehouse size={16} strokeWidth={1.75} /> : <FlaskConical size={16} strokeWidth={1.75} />}{label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.5rem' }}>{desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            {error && (
              <div style={{ marginBottom: '1rem', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit}>

              {/* Customer picker — shown for BOTH modes */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tujuan Pengiriman</h3>
                <div className="form-group">
                  <label className="form-label">
                    Pilih Pelanggan (Busdev) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  {loadingCustomers ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Memuat daftar pelanggan dari Accurate...
                    </div>
                  ) : (
                    <SearchableSelect
                      options={customers.map(c => ({
                        value: c.id.toString(),
                        label: `${c.name}${c.customerNo ? ` (${c.customerNo})` : ''}`,
                      }))}
                      value={destinationCustomer}
                      onChange={setDestinationCustomer}
                      placeholder={customers.length === 0 ? 'Tidak ada pelanggan tersedia' : '-- Ketik nama pelanggan --'}
                    />
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    *Menampilkan pelanggan dengan default salesperson "Busdev" di Accurate.
                  </p>
                </div>
              </div>

              {/* MAIN mode info banner */}
              {requestMode === 'MAIN' && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--info)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Warehouse size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '0.125rem' }} />Mode Gudang Utama — Stok akan diambil dari Accurate setelah disetujui WH Manager. Pilih sumber gudang per produk.
                </div>
              )}

              {/* Pilih Produk */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Kebutuhan Produk</h3>
                <div className="picker-row">
                  <div style={{ flex: 2 }}>
                    <label className="form-label">Pilih Produk</label>
                    {(requestMode === 'SAMPLE' ? loadingSample : loadingMain) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Memuat produk...
                      </div>
                    ) : (
                      <SearchableSelect
                        options={currentProductOptions}
                        value={currentProduct}
                        onChange={setCurrentProduct}
                        placeholder={currentProductOptions.length === 0 ? 'Tidak ada produk tersedia' : '-- Ketik nama produk --'}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Kuantitas ({currentUnit})</label>
                    <input
                      type="number" step="1" min="1"
                      className="form-control"
                      value={currentQty}
                      onChange={e => setCurrentQty(e.target.value)}
                      placeholder="Jumlah kemasan"
                    />
                  </div>
                  <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px', padding: '0 1.5rem' }}>Tambah</button>
                </div>

                {/* Product info card — SAMPLE mode */}
                {requestMode === 'SAMPLE' && sampleDetail && (
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {sampleDetail.unitGramasi && sampleDetail.gramasiPerUnit && (
                      <span><strong className="num" style={{ fontWeight: 600 }}>{sampleDetail.gramasiPerUnit}{sampleDetail.unitGramasi}</strong> per {sampleDetail.unit}</span>
                    )}
                    {currentSampleBalance != null && currentSampleBalance > 0 ? (
                      <span style={{ color: 'var(--success)' }}>Stok Sampel SPV: <strong className="num" style={{ fontWeight: 600 }}>{currentSampleBalance}</strong><span className="unit">{sampleDetail.unit}</span></span>
                    ) : (
                      <span style={{ color: 'var(--warning)' }}>Belum ada di gudang sampel — SPV akan melakukan pengadaan</span>
                    )}
                  </div>
                )}

                {/* Product info card — MAIN mode */}
                {requestMode === 'MAIN' && mainDetail && (
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {mainDetail.unitGramasi && mainDetail.gramasiPerUnit && (
                        <span><strong className="num" style={{ fontWeight: 600 }}>{mainDetail.gramasiPerUnit}{mainDetail.unitGramasi}</strong> per {mainDetail.unit}</span>
                      )}
                      <span style={{ color: mainDetail.spvStock ? 'var(--success)' : 'var(--text-muted)' }}>
                        Stok SPV: <strong className="num" style={{ fontWeight: 600 }}>{mainDetail.spvStock != null ? `${mainDetail.spvStock} ${mainDetail.unit}` : 'Belum tersinkron'}</strong>
                      </span>
                    </div>
                    {/* Warehouse picker per SKU */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}><Warehouse size={14} strokeWidth={1.75} />Sumber Gudang Accurate:</span>
                      {loadingWarehouses[currentProduct] ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14} strokeWidth={1.75} />Memuat daftar gudang...</span>
                      ) : warehouseOptions[currentProduct] ? (
                        <select
                          value={selectedWarehouses[currentProduct] ?? ''}
                          onChange={e => setSelectedWarehouses(prev => ({ ...prev, [currentProduct]: e.target.value }))}
                          style={{
                            padding: '0.25rem 0.5rem', fontSize: '0.8rem',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface)', color: 'var(--text-main)', fontWeight: 500, cursor: 'pointer',
                          }}
                        >
                          {warehouseOptions[currentProduct].map(wh => (
                            <option key={wh.name} value={wh.name}>
                              {wh.name}{wh.qty > 0 ? ` (${wh.qty.toLocaleString('id-ID')} ${mainDetail.unit} tersedia)` : ' (stok 0)'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pilih produk untuk melihat gudang tersedia</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Selected products table */}
                {selectedProducts.length > 0 ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Produk</th>
                          <th style={thStyle}>Diajukan</th>
                          {requestMode === 'MAIN' && <th style={thStyle}>Gudang</th>}
                          <th style={thStyle}>Setara Gramasi</th>
                          <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProducts.map(p => (
                          <tr key={p.productId}>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 500 }}>{p.name}</div>
                              {requestMode === 'SAMPLE' ? (
                                p.spvStock != null && p.spvStock > 0 ? (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok sampel: <span className="num">{p.spvStock}</span><span className="unit">{p.unit}</span></div>
                                ) : (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Belum ada di sampel</div>
                                )
                              ) : (
                                p.spvStock != null && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok SPV: <span className="num">{p.spvStock}</span><span className="unit">{p.unit}</span></div>
                                )
                              )}
                            </td>
                            <td style={tdStyle}>
                              <span className="num" style={{ fontWeight: 600, fontSize: '1rem' }}>{p.qtyRequested}</span>
                              <span className="unit">{p.unit}</span>
                            </td>
                            {requestMode === 'MAIN' && (
                              <td style={tdStyle}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Warehouse size={14} strokeWidth={1.75} />{p.accurateWarehouse ?? 'Gudang Baik'}
                                </span>
                              </td>
                            )}
                            <td style={tdStyle}>
                              {p.unitGramasi && p.gramasiPerUnit ? (
                                <span className="num" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                  {(p.qtyRequested * p.gramasiPerUnit).toLocaleString('id-ID')}{p.unitGramasi}
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <button type="button" onClick={() => removeProduct(p.productId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', padding: '0.25rem' }} aria-label="Hapus"><X size={16} strokeWidth={1.75} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', marginTop: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                    Belum ada produk yang ditambahkan.
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Catatan Tambahan <span style={{ color: 'var(--text-muted)' }}>(Opsional)</span></label>
                <textarea
                  className="form-control" rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={requestMode === 'SAMPLE' ? 'Contoh: Stok khusus untuk demo minggu depan...' : 'Contoh: Kebutuhan stok untuk program promosi Q2...'}
                />
              </div>

              <button
                type="submit" className="btn btn-primary"
                style={{
                  width: '100%', padding: '0.75rem', fontSize: '1rem',
                }}
                disabled={isPending || selectedProducts.length === 0 || !destinationCustomer}
              >
                {isPending
                  ? 'Mengirim Pengajuan...'
                  : requestMode === 'SAMPLE'
                    ? 'Kirim Pengajuan Stok ke SPV (Sampel)'
                    : 'Kirim Pengajuan Stok Gudang Utama'
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB RIWAYAT ─── */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingReqs ? (
            <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat riwayat...</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Belum ada pengajuan stok yang dikirim.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Jenis</th>
                    <th style={thStyle}>Tujuan / Catatan</th>
                    <th style={thStyle}>Produk</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                    <th style={thStyle}>Invoice</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono-stack)', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}
                      </td>
                      <td style={tdStyle}>
                        {req.warehouseSource === 'SAMPLE' ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><FlaskConical size={14} strokeWidth={1.75} />Sampel</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Warehouse size={14} strokeWidth={1.75} />Utama</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 200, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {req.plan && req.plan !== '-' ? req.plan.split('\n')[0] : '-'}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem' }}>
                        {req.details?.map((d: any) => {
                          const qty = d.qtyApproved != null ? d.qtyApproved : d.qtyRequested
                          return `${d.product?.name}: ${qty} ${d.requestUnit || d.product?.unit || ''}`
                        }).join(', ')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{getStatusBadge(req.status, req.warehouseSource)}</td>
                      {req.warehouseSource !== 'SAMPLE' ? (
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {req.accurateInvoiceNo ? (
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--success)', background: 'var(--success-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-mono-stack)' }}>
                              <FileText size={14} strokeWidth={1.75} />{req.accurateInvoiceNo}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      ) : (
                        <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                      )}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {(req.status === 'APPROVED' || (req.status === 'APPROVED_WHM' && req.warehouseSource !== 'SAMPLE')) && (
                          <button
                            onClick={() => handleDownloadPdf(req)}
                            className="btn btn-outline"
                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            <Download size={14} strokeWidth={1.75} className="icon-inline" />Download PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
