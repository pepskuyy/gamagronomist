'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'
import SearchableSelect from '@/components/SearchableSelect'

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
        setSelectedProducts([]); setCurrentProduct(''); setCurrentQty('')
        setNotes(''); setDestinationCustomer(''); setError(null)
        fetch('/api/bd-requests').then(r => r.json()).then(data => setRequests(Array.isArray(data) ? data : []))
        setActiveTab('history')
      }
    })
  }

  function getStatusBadge(status: string, warehouseSource?: string | null) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      SUBMITTED:       { label: 'Menunggu SPV',       color: '#92400e', bg: '#fef3c7' },
      APPROVED_SPV:    { label: 'Disetujui SPV',       color: '#1e40af', bg: '#dbeafe' },
      APPROVED_FAM:    { label: 'Disetujui FA Manager',color: '#5b21b6', bg: '#ede9fe' },
      APPROVED_WHM:    { label: 'Disetujui WH Manager',color: '#065f46', bg: '#d1fae5' },
      APPROVED:        { label: 'Selesai',              color: '#166534', bg: '#dcfce7' },
      REJECTED:        { label: 'Ditolak',              color: '#991b1b', bg: '#fee2e2' },
    }
    const s = map[status] ?? { label: status, color: 'var(--text-muted)', bg: 'var(--surface-2)' }
    return (
      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    )
  }

  const thStyle: React.CSSProperties = { padding: '0.65rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

  const currentProductOptions = requestMode === 'SAMPLE'
    ? sampleProducts.map(p => ({
        value: p.productId,
        label: p.gramasiPerUnit && p.unitGramasi
          ? `${p.productName} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit} • 🧪 ${p.balance} ${p.unit}`
          : `${p.productName} (${p.unit}) • 🧪 ${p.balance} ${p.unit}`,
      }))
    : mainProducts.map(p => ({
        value: p.id,
        label: p.gramasiPerUnit && p.unitGramasi
          ? `${p.name} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit}${p.spvStock != null ? ` • 🏭 ${p.spvStock} ${p.unit}` : ''}`
          : `${p.name} (${p.unit})${p.spvStock != null ? ` • 🏭 ${p.spvStock} ${p.unit}` : ''}`,
      }))

  const currentUnit = requestMode === 'SAMPLE' ? (sampleDetail?.unit || 'kemasan') : (mainDetail?.unit || 'kemasan')

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard" style={{ color: 'var(--text-muted)' }}>← Dashboard</Link>
        <div>
          <h2 style={{ margin: 0 }}>📦 Stok BD</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Pengajuan stok Busdev & riwayat permintaan.
          </p>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem' }}>
        {[
          { key: 'form',    label: '➕ Ajukan Stok Baru' },
          { key: 'history', label: '📋 Riwayat Pengajuan' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.65rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #7c3aed' : '2px solid transparent',
              color: activeTab === tab.key ? '#7c3aed' : 'var(--text-muted)',
              marginBottom: '-2px', transition: 'all 0.15s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* ─── TAB FORM ─── */}
      {activeTab === 'form' && (
        <div>
          {/* Mode selector */}
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>🏭 Ajukan dari Gudang:</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {([
                ['SAMPLE', '🧪 Gudang Sampel SPV', 'Approval 1 langkah oleh SPV. Untuk kebutuhan sampel & demo.', '#ede9fe', '#7c3aed'],
                ['MAIN',   '🏭 Gudang Utama (Accurate)', 'Approval penuh: SPV → FA Manager → WH Manager. Stok dari gudang Accurate.', '#dbeafe', '#1d4ed8'],
              ] as const).map(([val, label, desc, bg, color]) => (
                <label key={val} onClick={() => setRequestMode(val)}
                  style={{
                    flex: 1, minWidth: 200, cursor: 'pointer', padding: '0.85rem 1rem',
                    border: `2px solid ${requestMode === val ? color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', background: requestMode === val ? bg : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <input type="radio" name="requestMode" value={val} checked={requestMode === val} onChange={() => setRequestMode(val)} />
                    <span style={{ fontWeight: 700, color }}>{label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '1.4rem' }}>{desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            {error && (
              <div style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit}>

              {/* Customer picker — shown for BOTH modes */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📍 Tujuan Pengiriman</h3>
                <div className="form-group">
                  <label className="form-label">
                    Pilih Pelanggan (Busdev) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  {loadingCustomers ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
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
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: '#1d4ed8' }}>
                  🏭 Mode Gudang Utama — Stok akan diambil dari Accurate setelah disetujui WH Manager. Pilih sumber gudang per produk.
                </div>
              )}

              {/* Pilih Produk */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📦 Kebutuhan Produk</h3>
                <div className="picker-row">
                  <div style={{ flex: 2 }}>
                    <label className="form-label">Pilih Produk</label>
                    {(requestMode === 'SAMPLE' ? loadingSample : loadingMain) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
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
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: '#ede9fe', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {sampleDetail.unitGramasi && sampleDetail.gramasiPerUnit && (
                      <span>📐 <strong>{sampleDetail.gramasiPerUnit}{sampleDetail.unitGramasi}</strong> per {sampleDetail.unit}</span>
                    )}
                    {currentSampleBalance != null && currentSampleBalance > 0 ? (
                      <span style={{ color: '#5b21b6' }}>🧪 Stok Sampel SPV: <strong>{currentSampleBalance} {sampleDetail.unit}</strong></span>
                    ) : (
                      <span style={{ color: '#b45309' }}>🧪 Belum ada di gudang sampel — SPV akan melakukan pengadaan</span>
                    )}
                  </div>
                )}

                {/* Product info card — MAIN mode */}
                {requestMode === 'MAIN' && mainDetail && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {mainDetail.unitGramasi && mainDetail.gramasiPerUnit && (
                        <span>📐 <strong>{mainDetail.gramasiPerUnit}{mainDetail.unitGramasi}</strong> per {mainDetail.unit}</span>
                      )}
                      <span style={{ color: mainDetail.spvStock ? '#166534' : '#6b7280' }}>
                        🏪 Stok SPV: <strong>{mainDetail.spvStock != null ? `${mainDetail.spvStock} ${mainDetail.unit}` : 'Belum tersinkron'}</strong>
                      </span>
                    </div>
                    {/* Warehouse picker per SKU */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1d4ed8' }}>🏭 Sumber Gudang Accurate:</span>
                      {loadingWarehouses[currentProduct] ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏳ Memuat daftar gudang...</span>
                      ) : warehouseOptions[currentProduct] ? (
                        <select
                          value={selectedWarehouses[currentProduct] ?? ''}
                          onChange={e => setSelectedWarehouses(prev => ({ ...prev, [currentProduct]: e.target.value }))}
                          style={{
                            padding: '0.3rem 0.6rem', fontSize: '0.82rem',
                            border: '1.5px solid #bfdbfe', borderRadius: '0.35rem',
                            background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {warehouseOptions[currentProduct].map(wh => (
                            <option key={wh.name} value={wh.name}>
                              {wh.name}{wh.qty > 0 ? ` (${wh.qty.toLocaleString('id-ID')} ${mainDetail.unit} tersedia)` : ' (stok 0)'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pilih produk untuk melihat gudang tersedia</span>
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
                                  <div style={{ fontSize: '0.75rem', color: '#5b21b6' }}>🧪 Stok sampel: {p.spvStock} {p.unit}</div>
                                ) : (
                                  <div style={{ fontSize: '0.75rem', color: '#b45309' }}>🧪 Belum ada di sampel</div>
                                )
                              ) : (
                                p.spvStock != null && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok SPV: {p.spvStock} {p.unit}</div>
                                )
                              )}
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.qtyRequested}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{p.unit}</span>
                            </td>
                            {requestMode === 'MAIN' && (
                              <td style={tdStyle}>
                                <span style={{ fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600 }}>
                                  🏭 {p.accurateWarehouse ?? 'Gudang Baik'}
                                </span>
                              </td>
                            )}
                            <td style={tdStyle}>
                              {p.unitGramasi && p.gramasiPerUnit ? (
                                <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                                  {(p.qtyRequested * p.gramasiPerUnit).toLocaleString('id-ID')}{p.unitGramasi}
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <button type="button" onClick={() => removeProduct(p.productId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
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
                  width: '100%', padding: '0.8rem', fontSize: '1rem',
                  background: requestMode === 'MAIN' ? '#1d4ed8' : '#7c3aed',
                  borderColor: requestMode === 'MAIN' ? '#1d4ed8' : '#7c3aed',
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
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}
                      </td>
                      <td style={tdStyle}>
                        {req.warehouseSource === 'SAMPLE' ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>🧪 Sampel</span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>🏭 Utama</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 200, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {req.plan && req.plan !== '-' ? req.plan.split('\n')[0] : '-'}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.82rem' }}>
                        {req.details?.map(d => {
                          const qty = d.qtyApproved != null ? d.qtyApproved : d.qtyRequested
                          return `${d.product?.name}: ${qty} ${d.requestUnit || ''}`
                        }).join(', ')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{getStatusBadge(req.status, req.warehouseSource)}</td>
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
