'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GpsCapture from '@/components/GpsCapture'
import RegionSelect from '@/components/RegionSelect'
import SearchableSelect from '@/components/SearchableSelect'
import ImageUploader from '@/components/ImageUploader'
import { submitSpotDemplot } from '@/app/actions/spot-demplot'

type Product = { id: string; name: string; unit: string }
const WEED_OPTIONS = ['Daun Lebar', 'Daun Sempit', 'Teki-tekian', 'Pakis-pakisan', 'Berkayu']

export default function NewSpotDemplotPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Options
  const [products, setProducts] = useState<Product[]>([])
  const [stockBalance, setStockBalance] = useState<Record<string, number>>({})

  // Form states
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [selectedWeeds, setSelectedWeeds] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [usageList, setUsageList] = useState<{ id: number; productId: string; qty: string }[]>([])
  const [nextUsageId, setNextUsageId] = useState(1)

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(data => {
      setProducts(data || [])
    })
    fetch('/api/stock')
      .then(r => r.json())
      .then(d => {
        if (d?.ledger) {
          const bal: Record<string, number> = {}
          d.ledger.forEach((tx: any) => {
            bal[tx.productId] = (bal[tx.productId] || 0) + tx.quantity
          })
          setStockBalance(bal)
        }
      })
  }, [])

  function toggleWeed(weed: string) {
    if (selectedWeeds.includes(weed)) {
      setSelectedWeeds(selectedWeeds.filter(w => w !== weed))
    } else {
      setSelectedWeeds([...selectedWeeds, weed])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (latitude === null || longitude === null) {
      setError('Mohon izinkan dan ambil lokasi GPS terlebih dahulu.')
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('latitude', String(latitude))
    formData.set('longitude', String(longitude))
    formData.set('weeds', JSON.stringify(selectedWeeds))
    
    // Map usage
    const usagesToSave = usageList
      .filter(u => u.productId && parseFloat(u.qty) > 0)
      .map(u => ({ productId: u.productId, actualUsage: parseFloat(u.qty) }))
    
    formData.set('usages', JSON.stringify(usagesToSave))
    formData.set('photos', JSON.stringify(photos))

    const res = await submitSpotDemplot(formData)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/reports') // Redirect to reports
    }
  }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Spot Demplot</h2>
      </div>

      <form onSubmit={handleSubmit}>
        
        {/* LOKASI */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📍 Info Lokasi</h3>
          <div className="form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <RegionSelect nameKabupaten="district" nameKecamatan="districtKecamatan" nameDesa="districtDesa" required={true} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <GpsCapture onCapture={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
            </div>
          </div>
        </div>

        {/* DETAIL KEGIATAN */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📝 Detail & Pengamatan</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tanggal Pelaksanaan <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ marginBottom: '0.75rem' }}>Jenis Gulma (Bisa pilih lebih dari satu)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                {WEED_OPTIONS.map(weed => (
                  <label key={weed} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: selectedWeeds.includes(weed) ? 'var(--primary-light)' : 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${selectedWeeds.includes(weed) ? 'var(--primary)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={selectedWeeds.includes(weed)} onChange={() => toggleWeed(weed)} style={{ width: '1.2rem', height: '1.2rem' }} />
                    <span style={{ fontSize: '0.85rem' }}>{weed}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Hasil Pengamatan</label>
              <textarea name="observationResult" className="form-control" rows={3} placeholder="Ceritakan hasil pengamatan spot demplot..." />
            </div>
          </div>
        </div>

        {/* PENGGUNAAN PRODUK */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🧪 Penggunaan Produk</h3>
          <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>Pilih produk yang digunakan. Stok kamu akan otomatis dikurangi setelah disimpan.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {usageList.map((usage, idx) => {
              const selectedProduct = products.find(p => p.id === usage.productId)
              const onHand = selectedProduct ? stockBalance[selectedProduct.id] || 0 : 0
              
              return (
                <div key={usage.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 120px auto', gap: '0.75rem', alignItems: 'center', padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <SearchableSelect
                      options={products.filter(p => (stockBalance[p.id] || 0) > 0).map(p => ({ value: p.id, label: p.name }))}
                      value={usage.productId}
                      onChange={val => {
                        const newList = [...usageList]
                        newList[idx].productId = val
                        setUsageList(newList)
                      }}
                      placeholder="-- Cari Produk --"
                      required
                    />
                    {selectedProduct && (
                      <div style={{ fontSize: '0.78rem', color: onHand > 0 ? 'var(--primary)' : 'var(--text-muted)', marginTop: '0.4rem' }}>
                        Tersedia: <strong>{onHand} {selectedProduct.unit}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number" min="0" step="0.01"
                      className="form-control"
                      value={usage.qty}
                      onChange={e => {
                        const newList = [...usageList]
                        newList[idx].qty = e.target.value
                        setUsageList(newList)
                      }}
                      placeholder="0"
                      required
                    />
                    {selectedProduct && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{selectedProduct.unit}</span>}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setUsageList(usageList.filter(u => u.id !== usage.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
                    title="Hapus baris"
                  >
                    ×
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => {
                setUsageList([...usageList, { id: nextUsageId, productId: '', qty: '' }])
                setNextUsageId(nextUsageId + 1)
              }}
              style={{ padding: '0.75rem', background: 'var(--surface-hover)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 500, transition: 'all 0.15s', textAlign: 'center' }}
            >
              + Tambah Penggunaan Produk
            </button>
          </div>
        </div>

        {/* DOKUMENTASI */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📸 Dokumentasi</h3>
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
            {loading ? 'Menyimpan...' : 'Simpan Spot Demplot'}
          </button>
        </div>
      </form>
    </div>
  )
}
