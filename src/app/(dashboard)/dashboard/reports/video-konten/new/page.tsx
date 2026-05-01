'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import ImageUploader from '@/components/ImageUploader'
import { submitVideoKonten } from '@/app/actions/report'

type Product = { id: string; name: string }

export default function NewVideoKontenPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  
  // Form states
  const [photos, setPhotos] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<{ id: number; productId: string }[]>([])
  const [nextProductId, setNextProductId] = useState(1)

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data || [])
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (photos.length === 0) {
      setError('Dokumentasi foto wajib dilampirkan minimal 1 foto.')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    
    const productIdsToSave = selectedProducts
      .filter(p => p.productId)
      .map(p => p.productId)
    
    formData.set('products', JSON.stringify(productIdsToSave))
    formData.set('photos', JSON.stringify(photos))

    const res = await submitVideoKonten(formData)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/reports')
    }
  }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Laporan Video Konten</h2>
      </div>

      <form onSubmit={handleSubmit}>
        
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📝 Detail Video</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tanggal Upload <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="date" name="uploadDate" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Tema <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="theme" className="form-control" placeholder="Contoh: Edukasi Pemupukan Padi" required />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Produk Terkait</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pilih produk yang dibahas dalam video (bisa lebih dari satu).</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedProducts.map((sp, idx) => (
                  <div key={sp.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect
                        options={products.map(p => ({ value: p.id, label: p.name }))}
                        value={sp.productId}
                        onChange={val => {
                          const nl = [...selectedProducts]
                          nl[idx].productId = val
                          setSelectedProducts(nl)
                        }}
                        placeholder="-- Cari Produk --"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProducts(selectedProducts.filter(p => p.id !== sp.id))}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem 0.5rem' }}
                      title="Hapus baris"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProducts([...selectedProducts, { id: nextProductId, productId: '' }])
                    setNextProductId(nextProductId + 1)
                  }}
                  style={{ padding: '0.5rem', background: 'var(--surface-hover)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}
                >
                  + Tambah Produk
                </button>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Catatan</label>
              <textarea name="notes" className="form-control" rows={3} placeholder="Catatan tambahan (opsional)..." />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>📸 Dokumentasi (Screenshot Video) <span style={{ color: 'var(--danger)' }}>*</span></h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Minimal 1 foto wajib dilampirkan.</p>
          <ImageUploader onUploadSuccess={(urls) => setPhotos(urls)} />
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="Dokumentasi" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  <button type="button" onClick={() => setPhotos(photos.filter(p => p !== url))} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Laporan'}
          </button>
        </div>
      </form>
    </div>
  )
}
