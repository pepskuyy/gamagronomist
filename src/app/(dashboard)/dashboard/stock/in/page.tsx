'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'

type Product = { id: string, name: string, unit: string }

export default function StockInPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(e => console.error(e))
  }, [])

  function handleQuantityChange(productId: string, val: string) {
    const num = parseFloat(val) || 0
    setQuantities(prev => ({ ...prev, [productId]: num }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    
    // Construct the payload
    const payload = products
      .filter(p => quantities[p.id] > 0)
      .map(p => ({
        productId: p.id,
        qtyRequested: quantities[p.id]
      }))

    if (payload.length === 0) {
      setError('Masukkan jumlah minimal untuk satu produk.')
      return
    }

    const formData = new FormData(e.currentTarget)
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Ajukan Stok Masuk (Ke SPV)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Minta persetujuan tambahan stok dari SPV area Anda.</p>
        </div>
      </div>

      <div className="card">
        {error && <div className="alert-error" style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📦 Pilih Produk & Jumlah</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {products.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      min="0" step="0.01" 
                      className="form-control" 
                      style={{ width: '100px', textAlign: 'right' }}
                      placeholder="0"
                      value={quantities[p.id] || ''}
                      onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '40px' }}>{p.unit}</span>
                  </div>
                </div>
              ))}
              {products.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Memuat produk...</div>}
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Catatan Pengajuan</label>
            <textarea 
              name="notes" 
              className="form-control" 
              rows={3}
              placeholder="Contoh: Stok untuk persiapan musim tanam bulan depan..."
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={isPending}>
            {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Stok ke SPV'}
          </button>
        </form>
      </div>
    </div>
  )
}
