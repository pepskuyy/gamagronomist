'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'

type Product = { id: string, name: string, unit: string }
type SelectedProduct = { productId: string; qtyRequested: number; name: string; unit: string }

export default function StockInPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  
  // Dynamic form state
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct] = useState('')
  const [currentQty, setCurrentQty] = useState('')
  const [notes, setNotes] = useState('')
  
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(e => console.error(e))
  }, [])

  function addProduct() {
    if (!currentProduct || !currentQty || Number(currentQty) <= 0) return
    if (selectedProducts.find(p => p.productId === currentProduct)) { alert('Produk ini sudah ada dalam daftar.'); return }
    
    const detail = products.find(p => p.id === currentProduct)
    if (detail) {
      setSelectedProducts(prev => [
        ...prev, 
        { productId: detail.id, qtyRequested: Number(currentQty), name: detail.name, unit: detail.unit }
      ])
      setCurrentProduct('')
      setCurrentQty('')
    }
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    
    if (selectedProducts.length === 0) {
      setError('Masukkan minimal satu produk untuk diajukan.')
      return
    }

    const payload = selectedProducts.map(p => ({
      productId: p.productId,
      qtyRequested: p.qtyRequested
    }))

    const formData = new FormData()
    formData.append('notes', notes)
    formData.append('products', JSON.stringify(payload))

    startTransition(async () => {
      const res = await submitAfaStockRequest(formData)
      if (res?.error) {
        setError(res.error)
      } else {
        router.push('/dashboard/stock')
      }
    })
  }

  const tdStyle = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Ajukan Stok Masuk (Ke SPV)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Minta persetujuan tambahan stok dari SPV area Anda.</p>
        </div>
      </div>

      <div className="card">
        {error && <div className="alert-error" style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📦 Kebutuhan Produk</h3>
            
            <div className="picker-row">
              <div style={{ flex: 2 }}>
                <label className="form-label">Pilih Produk</label>
                <select className="form-control" value={currentProduct} onChange={e => setCurrentProduct(e.target.value)}>
                  <option value="">-- Pilih --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Kuantitas</label>
                <input type="number" step="0.01" min="0.01" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} />
              </div>
              <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px', padding: '0 1.5rem' }}>Tambah</button>
            </div>

            {selectedProducts.length > 0 ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--surface-hover)' }}>
                    <tr>
                      <th style={{ ...tdStyle, width: '50%' }}>Produk</th>
                      <th style={tdStyle}>Dibutuhkan</th>
                      <th style={{ ...tdStyle, width: '60px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((p) => (
                      <tr key={p.productId}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{p.qtyRequested}</span> 
                          <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{p.unit}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button type="button" onClick={() => removeProduct(p.productId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }}>✕</button>
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
            <label className="form-label">Catatan Pengajuan <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea 
              name="notes" 
              className="form-control" 
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Stok untuk persiapan musim tanam bulan depan..."
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }} disabled={isPending || selectedProducts.length === 0}>
            {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Stok ke SPV'}
          </button>
        </form>
      </div>
    </div>
  )
}
