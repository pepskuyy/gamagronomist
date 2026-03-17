'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitStockOpname } from '@/app/actions/opname'
import Link from 'next/link'

type ProductStock = {
  id: string
  name: string
  unit: string
  systemStock: number
}

// Simple Fetcher component wrapper
export default function StockOpnamePage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // State for physical counts
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    // In MVP, we fetch products and system balances. 
    // Usually we fetch via a dedicated API for current user's ledger summary
    fetch('/api/stock/summary')
      .then(res => res.json())
      .then(data => {
        setProducts(data)
        const initialCounts: Record<string, number> = {}
        data.forEach((p: ProductStock) => {
          initialCounts[p.id] = p.systemStock
        })
        setCounts(initialCounts)
        setLoading(false)
      })
      .catch(e => {
        setError('Gagal memuat saldo saat ini.')
        setLoading(false)
      })
  }, [])

  const handleCountChange = (id: string, val: string) => {
    setCounts({ ...counts, [id]: Number(val) || 0 })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    
    // Format counts
    const countsArray = Object.keys(counts).map(key => ({
      productId: key,
      physicalQty: counts[key]
    }))
    
    formData.append('counts', JSON.stringify(countsArray))

    const res = await submitStockOpname(formData)
    
    if (res?.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/stock')
      }, 1500)
    }
    setSubmitting(false)
  }

  if (loading) return <div>Memuat data stok...</div>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>📋 Validasi Stock Opname</h2>
      </div>

      <div className="card">
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Hitung stok fisik Anda dan masukkan pada kolom <strong>Fisik Aktual</strong>. Sistem akan otomatis melakukan penyesuaian (Adjustment) pada Ledger Anda jika ada selisih.
        </p>

        {error && <div className="alert-error" style={{ marginBottom: '1rem', color: 'red' }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: '1rem', display: 'block', textAlign: 'center', padding: '1rem' }}>✅ Validasi Opname selesai! Ledger di-update. Mengalihkan...</div>}

        <form onSubmit={handleSubmit}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '2rem' }}>
             <thead style={{ background: 'var(--surface-hover)' }}>
               <tr>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Stok Sistem (Ledger)</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '200px' }}>Fisik Aktual</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '120px' }}>Selisih</th>
               </tr>
             </thead>
             <tbody>
               {products.map(p => {
                 const diff = counts[p.id] - p.systemStock
                 return (
                 <tr key={p.id}>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{p.name}</td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {p.systemStock} {p.unit}
                   </td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01" 
                          className="form-control" 
                          style={{ padding: '0.4rem', margin: 0 }}
                          value={counts[p.id]}
                          onChange={(e) => handleCountChange(p.id, e.target.value)}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.unit}</span>
                      </div>
                   </td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ 
                        fontWeight: 600, 
                        color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {diff > 0 ? '+' : ''}{diff} {p.unit}
                      </span>
                   </td>
                 </tr>
               )})}
             </tbody>
          </table>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }} disabled={submitting}>
             {submitting ? 'Menyimpan Opname...' : 'Konfirmasi & Sesuaikan Ledger'}
          </button>
        </form>
      </div>
    </div>
  )
}
