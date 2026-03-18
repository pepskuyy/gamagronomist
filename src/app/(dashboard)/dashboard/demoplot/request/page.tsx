'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitRequestDemoPlot } from '@/app/actions/request'

type Product = { id: string; name: string; unit: string }
type SelectedProduct = { productId: string; qtyRequested: number; name: string; unit: string }

export default function FOStockRequestPage() {
  const router = useRouter()
  const [products, setProducts]               = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]   = useState('')
  const [currentQty, setCurrentQty]           = useState('')
  const [notes, setNotes]                     = useState('')
  const [error, setError]                     = useState<string | null>(null)
  const [isPending, start]                    = useTransition()

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts)
  }, [])

  function addProduct() {
    if (!currentProduct || !currentQty || Number(currentQty) <= 0) return
    if (selectedProducts.length >= 5) { alert('Maksimal 5 produk per pengajuan!'); return }
    if (selectedProducts.find(p => p.productId === currentProduct)) { alert('Produk ini sudah ada dalam daftar.'); return }
    const detail = products.find(p => p.id === currentProduct)
    if (detail) {
      setSelectedProducts(prev => [...prev, { productId: detail.id, qtyRequested: Number(currentQty), name: detail.name, unit: detail.unit }])
      setCurrentProduct(''); setCurrentQty('')
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedProducts.length === 0) { setError('Pilih minimal 1 produk.'); return }
    setError(null)
    const fd = new FormData()
    fd.append('notes', notes)
    fd.append('products', JSON.stringify(selectedProducts.map(p => ({ productId: p.productId, qtyRequested: p.qtyRequested }))))
    start(async () => {
      const res = await submitRequestDemoPlot(fd)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/demoplot')
    })
  }

  const tdStyle = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

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

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📋 Kebutuhan Produk (Maks. 5 jenis)</h3>

          {error && <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>}

          <div className="picker-row">
            <div style={{ flex: 2 }}>
              <label className="form-label">Pilih Produk</label>
              <select className="form-control" value={currentProduct} onChange={e => setCurrentProduct(e.target.value)}>
                <option value="">-- Pilih Produk --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Jumlah yang Dibutuhkan</label>
              <input type="number" step="0.01" min="1" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} placeholder="0" />
            </div>
            <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: 42, alignSelf: 'flex-end' }}>Tambah</button>
          </div>

          <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr>
                  <th style={{ ...tdStyle, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Produk</th>
                  <th style={{ ...tdStyle, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Jumlah Diminta</th>
                  <th style={{ ...tdStyle, width: 60, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}></th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map(p => (
                  <tr key={p.productId}>
                    <td style={tdStyle}><strong>{p.name}</strong></td>
                    <td style={tdStyle}>{p.qtyRequested} {p.unit}</td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => setSelectedProducts(prev => prev.filter(x => x.productId !== p.productId))} style={{ color: 'var(--danger)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                    </td>
                  </tr>
                ))}
                {selectedProducts.length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada produk ditambahkan</td></tr>
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
    </div>
  )
}
