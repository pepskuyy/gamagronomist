'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitRequestDemoPlot } from '@/app/actions/request'

type Product = { id: string, name: string, unit: string }
type SelectedProduct = { productId: string, qtyRequested: number, name: string, unit: string }

export default function FORequestPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct] = useState('')
  const [currentQty, setCurrentQty] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
  }, [])

  function addProduct() {
    if (!currentProduct || !currentQty || Number(currentQty) <= 0) return
    if (selectedProducts.length >= 5) {
      alert('Maksimal 5 produk per pengajuan!')
      return
    }
    
    if (selectedProducts.find(p => p.productId === currentProduct)) {
      alert('Produk ini sudah ada dalam daftar pengajuan.')
      return
    }

    const pDetail = products.find(p => p.id === currentProduct)
    if (pDetail) {
      setSelectedProducts([
        ...selectedProducts, 
        { productId: pDetail.id, qtyRequested: Number(currentQty), name: pDetail.name, unit: pDetail.unit }
      ])
      setCurrentProduct('')
      setCurrentQty('')
    }
  }

  function removeProduct(id: string) {
    setSelectedProducts(selectedProducts.filter(p => p.productId !== id))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedProducts.length === 0) {
      setError('Minimal pilih 1 produk untuk diajukan.')
      return
    }

    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    formData.append('products', JSON.stringify(selectedProducts.map(p => ({
      productId: p.productId,
      qtyRequested: p.qtyRequested
    }))))

    const res = await submitRequestDemoPlot(formData)
    
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/demoplot')
    }
  }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Pengajuan Demo Plot Baru</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Data Petani & Area</h3>
            <div className="form-group">
              <label className="form-label">Nama Petani</label>
              <input name="farmerName" type="text" className="form-control" required placeholder="Bpk. Budi" />
            </div>
            <div className="form-group">
              <label className="form-label">No. Telepon (Opsional)</label>
              <input name="farmerPhone" type="text" className="form-control" placeholder="0812xxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Area (Desa / Kecamatan)</label>
              <input name="area" type="text" className="form-control" required placeholder="Kec. Ngimbang" />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Detail Rencana</h3>
            <div className="form-group">
              <label className="form-label">Komoditas</label>
              <input name="commodity" type="text" className="form-control" required placeholder="Padi / Jagung / Bawang" />
            </div>
            <div className="form-group">
              <label className="form-label">Masalah Utama (CB)</label>
              <textarea name="problem" className="form-control" rows={2} required placeholder="Hama wereng mengganas" />
            </div>
            <div className="form-group">
              <label className="form-label">Rencana Demo Plot</label>
              <textarea name="plan" className="form-control" rows={2} required placeholder="Rencana semprot 2x interval 1 minggu" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Kebutuhan Produk (Maks 5)</h3>
          
          {error && <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

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
              <input type="number" step="0.01" min="1" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} />
            </div>
            <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px' }}>
              Tambah
            </button>
          </div>

          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--surface-hover)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Qty</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '60px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map(p => (
                  <tr key={p.productId}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{p.qtyRequested} {p.unit}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <button type="button" onClick={() => removeProduct(p.productId)} style={{ color: 'var(--danger)', fontWeight: 'bold' }}>✕</button>
                    </td>
                  </tr>
                ))}
                {selectedProducts.length === 0 && (
                  <tr>
                     <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada produk ditambahkan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }} disabled={loading}>
           {loading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Demo Plot'}
        </button>
      </form>
    </div>
  )
}
