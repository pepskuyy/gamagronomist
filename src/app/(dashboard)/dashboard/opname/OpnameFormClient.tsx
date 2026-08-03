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

type ProductMaster = {
  id: string
  name: string
  unit: string
  unitGramasi: string | null
  gramasiPerUnit: number | null
}

export default function OpnameFormClient() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductStock[]>([])
  const [allProducts, setAllProducts] = useState<ProductMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  
  // State for newly added product rows
  const [addedProductIds, setAddedProductIds] = useState<string[]>([])
  const [showAddRow, setShowAddRow] = useState(false)
  const [selectedNewProduct, setSelectedNewProduct] = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetch('/api/stock/summary').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ])
      .then(([summaryData, productsData]) => {
        setProducts(summaryData)
        setAllProducts(productsData)
        
        const initialCounts: Record<string, number> = {}
        summaryData.forEach((p: ProductStock) => {
          initialCounts[p.id] = p.systemStock
        })
        setCounts(initialCounts)
        setLoading(false)
      })
      .catch(e => {
        setError('Gagal memuat data.')
        setLoading(false)
      })
  }, [])

  const handleCountChange = (id: string, val: string) => {
    setCounts({ ...counts, [id]: Number(val) || 0 })
  }

  const handleNoteChange = (id: string, val: string) => {
    setNotes({ ...notes, [id]: val })
  }

  const handleAddNewProduct = () => {
    if (!selectedNewProduct) return
    
    if (products.some(p => p.id === selectedNewProduct) || addedProductIds.includes(selectedNewProduct)) {
      alert('Produk ini sudah ada di dalam list opname.')
      return
    }

    const prod = allProducts.find(p => p.id === selectedNewProduct)
    if (prod) {
      setAddedProductIds([...addedProductIds, prod.id])
      setCounts({ ...counts, [prod.id]: 0 }) // default 0 for actual physical count
      setSelectedNewProduct('')
      setShowAddRow(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    
    const countsArray = Object.keys(counts).map(key => ({
      productId: key,
      physicalQty: counts[key],
      notes: notes[key] || ""
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

  // Gabungkan produk dari saldo sistem dengan produk yang ditambahkan manual
  const combinedProducts = [
    ...products,
    ...addedProductIds.map(id => {
      const p = allProducts.find(x => x.id === id)!
      return { id: p.id, name: p.name, unit: p.unitGramasi || p.unit, systemStock: 0 }
    })
  ]

  // Filter produk untuk dropdown (hanya yang belum ada di list)
  const availableProducts = allProducts.filter(p => !combinedProducts.some(cp => cp.id === p.id))

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>⬅️ Kembali</Link>
        <h2 style={{ margin: 0 }}>📝 Validasi Stock Opname</h2>
      </div>

      <div className="card">
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Hitung stok fisik Anda dan masukkan pada kolom <strong>Fisik Aktual</strong>. Pengajuan penyesuaian jika ada selisih memerlukan persetujuan SPV. Anda juga dapat menambahkan barang (misal dari Gudang Utama/Sampel) yang fisiknya ada namun belum tercatat di sistem dengan mengklik tombol "Tambah Produk Lain". Keterangan wajib diisi pada baris yang memiliki selisih stok.
        </p>

        {error && <div className="alert-error" style={{ marginBottom: '1rem', color: 'red' }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: '1rem', display: 'block', textAlign: 'center', padding: '1rem' }}>✅ Pengajuan opname berhasil dikirim ke SPV! Mengalihkan...</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '1rem' }}>
             <thead style={{ background: 'var(--surface-hover)' }}>
               <tr>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Stok Sistem (Ledger)</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', minWidth: '120px' }}>Fisik Aktual</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '120px' }}>Selisih</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '250px' }}>Keterangan / Alasan</th>
               </tr>
             </thead>
             <tbody>
               {combinedProducts.map(p => {
                 const diff = counts[p.id] - p.systemStock
                 const isAdded = addedProductIds.includes(p.id)
                 return (
                 <tr key={p.id} style={{ background: isAdded ? '#f0fdf4' : undefined }}>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                     {p.name}
                     {isAdded && <span style={{ display: 'block', fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>+ Ditambahkan Manual</span>}
                   </td>
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
                          style={{ padding: '0.4rem', margin: 0, minWidth: '80px', borderColor: isAdded ? '#16a34a' : undefined }}
                          value={counts[p.id] ?? ''}
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
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <input 
                          type="text" 
                          className="form-control" 
                          placeholder={diff !== 0 ? "Wajib diisi..." : "-"}
                          style={{ padding: '0.4rem', margin: 0, borderColor: diff !== 0 && !notes[p.id] ? 'var(--danger)' : undefined }}
                          value={notes[p.id] || ''}
                          onChange={(e) => handleNoteChange(p.id, e.target.value)}
                          required={diff !== 0}
                          disabled={diff === 0}
                        />
                   </td>
                 </tr>
               )})}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '2rem', background: 'var(--surface)', padding: '1rem', borderRadius: '0.5rem', border: '1px dashed var(--border)' }}>
            {!showAddRow ? (
              <button 
                type="button" 
                onClick={() => setShowAddRow(true)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span style={{ fontSize: '1.2rem' }}>+</span> Tambah Produk Lain (Barang Belum Tercatat)
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Pilih Produk</label>
                  <select 
                    className="form-control" 
                    value={selectedNewProduct} 
                    onChange={e => setSelectedNewProduct(e.target.value)}
                  >
                    <option value="">-- Pilih produk dari database --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={handleAddNewProduct} className="btn btn-primary" disabled={!selectedNewProduct}>
                  Tambahkan ke List
                </button>
                <button type="button" onClick={() => setShowAddRow(false)} className="btn btn-secondary">
                  Batal
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }} disabled={submitting}>
             {submitting ? 'Mengirim Pengajuan...' : 'Ajukan Penyesuaian ke SPV'}
          </button>
        </form>
      </div>
    </div>
  )
}
