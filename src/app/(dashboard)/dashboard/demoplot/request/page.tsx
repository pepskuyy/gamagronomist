'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitRequestDemoPlot } from '@/app/actions/request'
import SearchableSelect from '@/components/SearchableSelect'

type AfaProduct = { 
  id: string; name: string; unit: string; balance: number;
  unitGramasi?: string | null; gramasiPerUnit?: number | null; balanceKemasan?: number | null
}
type SelectedProduct = { 
  productId: string; qtyRequested: number; name: string; 
  unitGramasi?: string | null; unit: string; afaBalance: number
}

export default function FOStockRequestPage() {
  const router = useRouter()
  const [afaProducts, setAfaProducts]           = useState<AfaProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]     = useState('')
  const [currentQty, setCurrentQty]             = useState('')
  const [notes, setNotes]                       = useState('')
  const [error, setError]                       = useState<string | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [isPending, start]                      = useTransition()

  useEffect(() => {
    fetch('/api/afa-stock')
      .then(r => r.json())
      .then(data => { setAfaProducts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function addProduct() {
    if (!currentProduct || !currentQty || Number(currentQty) <= 0) return
    if (selectedProducts.find(p => p.productId === currentProduct)) { alert('Produk ini sudah ada dalam daftar.'); return }
    const detail = afaProducts.find(p => p.id === currentProduct)
    if (!detail) return

    const qty = Number(currentQty)
    if (qty <= 0) return
    // balance is in gramasi (ml/gr); if no gramasi, fall back to kemasan check
    const effectiveMax = detail.balance
    if (qty > effectiveMax) {
      const unitLabel = detail.unitGramasi || detail.unit
      alert(`Jumlah melebihi stok AFA! Stok tersedia: ${detail.balance} ${unitLabel}`)
      return
    }

    setSelectedProducts(prev => [...prev, {
      productId: detail.id,
      qtyRequested: qty,
      name: detail.name,
      unit: detail.unitGramasi || detail.unit,  // FO requests in gramasi
      afaBalance: detail.balance,
    }])
    setCurrentProduct('')
    setCurrentQty('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedProducts.length === 0) { setError('Pilih minimal 1 produk.'); return }
    setError(null)
    const fd = new FormData()
    fd.append('notes', notes)
    fd.append('products', JSON.stringify(selectedProducts.map(p => ({ productId: p.productId, qtyRequested: p.qtyRequested, requestUnit: p.unit }))))
    start(async () => {
      const res = await submitRequestDemoPlot(fd)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/demoplot')
    })
  }

  const tdStyle = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

  // Available products = AFA products minus already-selected ones
  const availableOptions = afaProducts
    .filter(p => !selectedProducts.find(s => s.productId === p.id))
    .map(p => ({
      value: p.id,
      label: p.unitGramasi
        ? `${p.name} — stok: ${p.balance} ${p.unitGramasi}${p.balanceKemasan != null ? ` (≈${p.balanceKemasan} ${p.unit})` : ''}`
        : `${p.name} — stok: ${p.balance} ${p.unit}`,
    }))

  const selectedAfaProduct = afaProducts.find(p => p.id === currentProduct)

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>📦 Pengajuan Pengambilan Stok</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Ajukan kebutuhan produk sample kepada AFA supervisormu</p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#1e40af' }}>
        <strong>ℹ️ Alur Baru:</strong> Pengajuan ini hanya untuk mengambil stok produk dari AFA.
        Setelah disetujui, kamu bisa langsung melakukan demo plot <strong>kapan saja</strong> tanpa perlu membuat pengajuan baru.
      </div>

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          Memuat data stok AFA...
        </div>
      ) : afaProducts.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>Stok AFA Kosong</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            AFA supervisor Anda belum memiliki stok produk apapun. Hubungi AFA untuk meminta stok ke SPV terlebih dahulu.
          </p>
        </div>
      ) : (
        <>
          {/* AFA Stock Overview */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📊 Stok AFA Saat Ini</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {afaProducts.map(p => (
                <div key={p.id} style={{
                  padding: '0.75rem 1rem',
                  background: p.balance > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${p.balance > 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>{p.name}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: p.balance > 0 ? '#16a34a' : '#dc2626' }}>
                    {p.balance.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{p.unitGramasi || p.unit}</span>
                  </div>
                  {p.unitGramasi && p.balanceKemasan != null && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>≈ {p.balanceKemasan} {p.unit}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>📋 Kebutuhan Produk</h3>

              {error && <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>}

              <div className="picker-row">
                <div style={{ flex: 2 }}>
                  <label className="form-label">Pilih Produk (dari stok AFA)</label>
                  <SearchableSelect 
                    options={availableOptions}
                    value={currentProduct}
                    onChange={setCurrentProduct}
                    placeholder="-- Ketik nama produk --"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">
                    Jumlah (dalam {afaProducts.find(p => p.id === currentProduct)?.unitGramasi || afaProducts.find(p => p.id === currentProduct)?.unit || 'gramasi'})
                    {selectedAfaProduct && (
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        (maks: {selectedAfaProduct.balance.toLocaleString()} {selectedAfaProduct.unitGramasi || selectedAfaProduct.unit})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedAfaProduct?.balance || undefined}
                    className="form-control"
                    value={currentQty}
                    onChange={e => setCurrentQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: 42, alignSelf: 'flex-end' }}>Tambah</button>
              </div>

              <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--surface-2)' }}>
                    <tr>
                      <th style={{ ...tdStyle, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Produk</th>
                      <th style={{ ...tdStyle, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Stok AFA</th>
                      <th style={{ ...tdStyle, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Jumlah Diminta</th>
                      <th style={{ ...tdStyle, width: 60, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map(p => (
                      <tr key={p.productId}>
                        <td style={tdStyle}><strong>{p.name}</strong></td>
                        <td style={tdStyle}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{p.afaBalance}</span> {p.unit}
                        </td>
                        <td style={tdStyle}>{p.qtyRequested} {p.unit}</td>
                        <td style={tdStyle}>
                          <button type="button" onClick={() => setSelectedProducts(prev => prev.filter(x => x.productId !== p.productId))} style={{ color: 'var(--danger)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {selectedProducts.length === 0 && (
                      <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada produk ditambahkan</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>📝 Catatan untuk AFA (Opsional)</h3>
              <textarea className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Untuk demo plot di area Kec. Ngimbang bulan ini..." style={{ resize: 'none' }} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }} disabled={isPending}>
              {isPending ? 'Mengirim Pengajuan...' : '📤 Kirim Pengajuan Stok ke AFA'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
