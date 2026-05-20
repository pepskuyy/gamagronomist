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
type SelectedProduct = {
  productId:      string
  qtyRequested:   number
  name:           string
  unit:           string
  unitGramasi?:   string | null
  gramasiPerUnit?:number | null
  spvStock?:      number | null
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
  details: { product: { name: string }; qtyRequested: number; qtyApproved: number | null; requestUnit: string }[]
}

export default function BdStockRequestPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  // Form state
  const [sampleProducts, setSampleProducts]     = useState<SampleProduct[]>([])
  const [loadingSample, setLoadingSample]       = useState(true)
  const [customers, setCustomers]               = useState<BdCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]     = useState('')
  const [currentQty, setCurrentQty]             = useState('')
  const [notes, setNotes]                       = useState('')
  const [destinationCustomer, setDestinationCustomer] = useState('')
  const [error, setError]                       = useState<string | null>(null)
  const [isPending, startTransition]            = useTransition()

  // History state
  const [requests, setRequests]       = useState<Request[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)

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

  const sampleDetail = sampleProducts.find(s => s.productId === currentProduct)
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
    setCurrentProduct(''); setCurrentQty('')
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    if (selectedProducts.length === 0) { setError('Masukkan minimal satu produk.'); return }
    if (!destinationCustomer) { setError('Pilih tujuan pengiriman pelanggan.'); return }

    const payload = selectedProducts.map(p => ({ productId: p.productId, qtyRequested: p.qtyRequested }))
    const customerObj = customers.find(c => c.id.toString() === destinationCustomer)
    const customerName = customerObj ? customerObj.name : '-'
    const finalNotes = `Tujuan Pengiriman: ${customerName}\n\n${notes}`

    const formData = new FormData()
    formData.append('notes', finalNotes)
    formData.append('products', JSON.stringify(payload))
    formData.append('warehouseSource', 'SAMPLE')

    startTransition(async () => {
      const res = await submitAfaStockRequest(formData)
      if (res?.error) setError(res.error)
      else {
        // Reset form & switch ke tab riwayat
        setSelectedProducts([]); setCurrentProduct(''); setCurrentQty('')
        setNotes(''); setDestinationCustomer(''); setError(null)
        // Refresh riwayat
        fetch('/api/bd-requests').then(r => r.json()).then(data => setRequests(Array.isArray(data) ? data : []))
        setActiveTab('history')
      }
    })
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      SUBMITTED:       { label: 'Menunggu Approval', color: '#92400e', bg: '#fef3c7' },
      APPROVED_SPV:    { label: 'Disetujui SPV',     color: '#1e40af', bg: '#dbeafe' },
      APPROVED_FAM:    { label: 'Disetujui FAM',     color: '#065f46', bg: '#d1fae5' },
      APPROVED_WHM:    { label: 'Disetujui WHM',     color: '#065f46', bg: '#d1fae5' },
      APPROVED:        { label: 'Selesai',            color: '#166534', bg: '#dcfce7' },
      REJECTED:        { label: 'Ditolak',            color: '#991b1b', bg: '#fee2e2' },
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

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard" style={{ color: 'var(--text-muted)' }}>← Dashboard</Link>
        <div>
          <h2 style={{ margin: 0 }}>📦 Stok BD</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Pengajuan stok sampel & riwayat permintaan Busdev.
          </p>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', gap: '0' }}>
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
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.5rem 0.9rem', background: '#ede9fe', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#5b21b6' }}>
            <span>🧪 Mode Permintaan Sampel</span>
            <span>Pengajuan stok BD hanya diambil dari Gudang Sampel SPV.</span>
          </div>

          {error && (
            <div style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Tujuan Pengiriman */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📍 Tujuan Pengiriman</h3>
              <div className="form-group">
                <label className="form-label">Pilih Pelanggan (Busdev) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <SearchableSelect
                  options={customers.map(c => ({
                    value: c.id.toString(),
                    label: `${c.name}${c.customerNo ? ` (${c.customerNo})` : ''}`,
                  }))}
                  value={destinationCustomer}
                  onChange={setDestinationCustomer}
                  placeholder={loadingCustomers ? 'Memuat daftar pelanggan...' : customers.length === 0 ? 'Tidak ada pelanggan tersedia' : '-- Ketik nama pelanggan --'}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  *Menampilkan pelanggan dengan default salesperson "Busdev" di Accurate.
                </p>
              </div>
            </div>

            {/* Pilih Produk */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📦 Kebutuhan Produk</h3>
              <div className="picker-row">
                <div style={{ flex: 2 }}>
                  <label className="form-label">Pilih Produk</label>
                  <SearchableSelect
                    options={sampleProducts.map(p => ({
                      value: p.productId,
                      label: p.gramasiPerUnit && p.unitGramasi
                        ? `${p.productName} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit} • 🧪 ${p.balance} ${p.unit}`
                        : `${p.productName} (${p.unit}) • 🧪 ${p.balance} ${p.unit}`,
                    }))}
                    value={currentProduct}
                    onChange={setCurrentProduct}
                    placeholder={loadingSample ? 'Memuat stok sampel...' : sampleProducts.length === 0 ? 'Tidak ada produk tersedia di gudang sampel' : '-- Ketik nama produk --'}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">
                    Kuantitas ({sampleDetail?.unit || 'kemasan'})
                    {currentSampleBalance != null && currentSampleBalance > 0 && (
                      <span style={{ fontWeight: 400, color: '#7c3aed', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        maks {currentSampleBalance} {sampleDetail?.unit}
                      </span>
                    )}
                  </label>
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

              {sampleDetail && (
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

              {selectedProducts.length > 0 ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Produk</th>
                        <th style={thStyle}>Diajukan</th>
                        <th style={thStyle}>Setara Gramasi</th>
                        <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map(p => (
                        <tr key={p.productId}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 500 }}>{p.name}</div>
                            {p.spvStock != null && p.spvStock > 0 ? (
                              <div style={{ fontSize: '0.75rem', color: '#5b21b6' }}>🧪 Stok sampel: {p.spvStock} {p.unit}</div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#b45309' }}>🧪 Belum ada di sampel</div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.qtyRequested}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{p.unit}</span>
                          </td>
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
                placeholder="Contoh: Stok khusus untuk demo minggu depan..."
              />
            </div>

            <button
              type="submit" className="btn btn-primary"
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: '#7c3aed', borderColor: '#7c3aed' }}
              disabled={isPending || selectedProducts.length === 0 || !destinationCustomer}
            >
              {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Stok ke SPV'}
            </button>
          </form>
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
                      <td style={{ ...tdStyle, maxWidth: 200, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {req.plan && req.plan !== '-' ? req.plan.split('\n')[0] : '-'}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.82rem' }}>
                        {req.details?.map(d => {
                          const qty = d.qtyApproved != null ? d.qtyApproved : d.qtyRequested
                          return `${d.product?.name}: ${qty} ${d.requestUnit || ''}`
                        }).join(', ')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{getStatusBadge(req.status)}</td>
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
