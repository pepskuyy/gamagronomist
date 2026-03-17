'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitStockIn } from '@/app/actions/stock'

type Product = { id: string, name: string, unit: string }

export default function StockInPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch products inside useEffect for demonstration (in real app can use RSC)
  useEffect(() => {
    fetch('/api/products') // We will create this simple API route
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(e => console.error(e))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    const res = await submitStockIn(formData)
    
    if (res?.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      e.currentTarget.reset()
      setTimeout(() => {
         router.push('/dashboard/stock')
      }, 1500)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Input Stok Masuk (Dari Gudang)</h2>
      </div>

      <div className="card">
        {error && <div className="alert-error" style={{ marginBottom: '1rem', color: 'red' }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: '1rem', display: 'block', textAlign: 'center', padding: '1rem' }}>✅ Stok berhasil ditambahkan ke Ledger! Mengalihkan...</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Produk</label>
            <select name="productId" className="form-control" required disabled={products.length === 0}>
              <option value="">-- Pilih Produk --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Kuantitas</label>
            <input 
              type="number" 
              name="quantity" 
              className="form-control" 
              min="1"
              step="0.01"
              required 
              placeholder="Contoh: 100"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Catatan (Opsional)</label>
            <textarea 
              name="notes" 
              className="form-control" 
              rows={3}
              placeholder="Misal: Batch 003 dari Gudang Pusat"
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Transaksi Stok'}
          </button>
        </form>
      </div>
    </div>
  )
}
