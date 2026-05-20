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
  balance:        number  // stok sampel SPV (kemasan)
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

export default function BdStockRequestPage() {
  const router = useRouter()

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

  useEffect(() => {
    // Fetch sample warehouse products
    fetch('/api/sample-stock-for-afa')
      .then(r => r.json())
      .then(data => {
        setSampleProducts(Array.isArray(data) ? data : [])
        setLoadingSample(false)
      })
      .catch(() => setLoadingSample(false))

    // Fetch BD customers
    fetch('/api/bd-customers')
      .then(r => r.json())
      .then(data => {
        setCustomers(data.customers ?? [])
        setLoadingCustomers(false)
      })
      .catch(() => setLoadingCustomers(false))
  }, [])

  const sampleDetail = sampleProducts.find(s => s.productId === currentProduct)
  const currentSampleBalance = sampleDetail?.balance ?? null

  function addProduct() {
    const qty = Number(currentQty)
    if (!currentProduct || qty <= 0) return
    if (!Number.isInteger(qty)) {
      alert('Pengajuan ke SPV harus dalam satuan kemasan utuh (bilangan bulat). Tidak bisa eceran.')
      return
    }
    if (selectedProducts.find(p => p.productId === currentProduct)) {
      alert('Produk ini sudah ada dalam daftar.'); return
    }

    const sampleP = sampleProducts.find(s => s.productId === currentProduct)
    if (!sampleP) return
    const sampleBalance = sampleP.balance
    if (sampleBalance <= 0) {
      alert('Produk ini tidak tersedia di gudang sampel SPV.')
      return
    }
    setSelectedProducts(prev => [...prev, {
      productId:      sampleP.productId,
      qtyRequested:   qty,
      name:           sampleP.productName,
      unit:           sampleP.unit,
      unitGramasi:    sampleP.unitGramasi,
      gramasiPerUnit: sampleP.gramasiPerUnit,
      spvStock:       sampleBalance,
    }])
    setCurrentProduct('')
    setCurrentQty('')
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    
    if (selectedProducts.length === 0) {
      setError('Masukkan minimal satu produk untuk diajukan.'); return
    }
    if (!destinationCustomer) {
      setError('Pilih tujuan pengiriman pelanggan.'); return
    }

    const payload = selectedProducts.map(p => ({
      productId: p.productId,
      qtyRequested: p.qtyRequested,
    }))

    const customerObj = customers.find(c => c.id.toString() === destinationCustomer)
    const customerName = customerObj ? customerObj.name : '-'

    // Gabungkan tujuan pengiriman ke dalam notes agar tercatat di database plan/notes
    const finalNotes = `Tujuan Pengiriman: ${customerName}\n\n${notes}`

    const formData = new FormData()
    formData.append('notes', finalNotes)
    formData.append('products', JSON.stringify(payload))
    formData.append('warehouseSource', 'SAMPLE') // BD SELALU dari SAMPLE

    startTransition(async () => {
      const res = await submitAfaStockRequest(formData)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/stock')
    })
  }

  const thStyle: React.CSSProperties = { padding: '0.65rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Pengajuan Stok Sampel (BD)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Minta persetujuan tambahan stok dari Gudang Sampel SPV.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.9rem', background: '#ede9fe', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#5b21b6' }}>
        <span>🧪 Mode Permintaan Sampel</span>
        <span>Pengajuan stok BD hanya diambil dari Gudang Sampel SPV.</span>
      </div>

      <div className="card">
        {error && (
          <div style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Destination Customer Field */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📍 Tujuan Pengiriman</h3>
            <div className="form-group">
              <label className="form-label">Pilih Pelanggan (Busdev) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <SearchableSelect
                options={customers.map(c => ({
                  value: c.id.toString(),
                  label: `${c.name} ${c.customerNo ? `(${c.customerNo})` : ''}`
                }))}
                value={destinationCustomer}
                onChange={setDestinationCustomer}
                placeholder={loadingCustomers ? 'Memuat daftar pelanggan...' : '-- Ketik nama pelanggan --'}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                *Hanya menampilkan pelanggan yang default salesperson-nya adalah "Busdev" di Accurate.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📦 Kebutuhan Produk</h3>

            <div className="picker-row">
              <div style={{ flex: 2 }}>
                <label className="form-label">Pilih Produk</label>
                <SearchableSelect
                  options={sampleProducts.map(p => ({
                    value: p.productId,
                    label: p.gramasiPerUnit && p.unitGramasi
                      ? `${p.productName} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit} • 🧪 Stok: ${p.balance} ${p.unit}`
                      : `${p.productName} (${p.unit}) • 🧪 Stok: ${p.balance} ${p.unit}`,
                  }))}
                  value={currentProduct}
                  onChange={setCurrentProduct}
                  placeholder={loadingSample ? 'Memuat stok sampel...' : '-- Ketik nama produk --'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">
                  Kuantitas ({sampleDetail?.unit || 'kemasan'})
                  {currentSampleBalance != null && currentSampleBalance > 0 && (
                    <span style={{ fontWeight: 400, color: '#7c3aed', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      {currentSampleBalance} {sampleDetail?.unit} tersedia di sampel
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
                  <span style={{ color: '#5b21b6' }}>
                    🧪 Stok Sampel SPV: <strong>{currentSampleBalance} {sampleDetail.unit}</strong> (tersedia)
                  </span>
                ) : (
                  <span style={{ color: '#b45309' }}>
                    🧪 Belum ada di gudang sampel — SPV akan melakukan pengadaan
                  </span>
                )}
                <span style={{ color: '#92400e' }}>⚠️ Pengajuan hanya dalam kemasan utuh</span>
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
                            <div style={{ fontSize: '0.75rem', color: '#b45309' }}>🧪 Belum ada di sampel — pengadaan oleh SPV</div>
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
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          )}
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
            <label className="form-label">Catatan Pengajuan Tambahan <span style={{ color: 'var(--text-muted)' }}>(Opsional)</span></label>
            <textarea
              name="notes"
              className="form-control"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Stok khusus untuk demo minggu depan..."
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: '#7c3aed', borderColor: '#7c3aed' }}
            disabled={isPending || selectedProducts.length === 0 || !destinationCustomer}
          >
            {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Stok ke SPV'}
          </button>
        </form>
      </div>
    </div>
  )
}
