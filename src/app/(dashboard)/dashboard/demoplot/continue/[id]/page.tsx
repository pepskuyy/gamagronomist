'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { submitContinueDemoPlot } from '@/app/actions/standalone-demoplot'
import ImageUploader from '@/components/ImageUploader'
import GpsCapture from '@/components/GpsCapture'

type Product = { id: string; name: string; unit: string }
type RequestData = {
  id: string
  farmer: { name: string } | null
  area: string | null
  commodity: string | null
  status: string
  details: { product: { name: string; id: string; unit: string }; qtyRequested: number }[]
}

export default function ContinueDemoPlotPage() {
  const router  = useRouter()
  const { id }  = useParams<{ id: string }>()

  const [reqData, setReqData]   = useState<RequestData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stockBalance, setStock] = useState<Record<string, number>>({})
  const [usageList, setUsageList] = useState<{ id: string, productId: string, qty: string }[]>([])
  const [lat, setLat]           = useState<number | null>(null)
  const [lng, setLng]           = useState<number | null>(null)
  const [photos, setPhotos]     = useState<string[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  useEffect(() => {
    fetch(`/api/demoplot-request/${id}`).then(r => r.json()).then(setReqData)
    fetch('/api/products').then(r => r.json()).then(setProducts)
    fetch('/api/stock/balance').then(r => r.json()).then((data: { productId: string; quantity: number }[]) => {
      const map: Record<string, number> = {}
      data.forEach(s => { map[s.productId] = s.quantity })
      setStock(map)
    }).catch(() => {})
  }, [id])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (lat === null || lng === null) { setError('GPS wajib diambil sebelum menyimpan sesi.'); return }
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.append('latitude', String(lat))
    fd.append('longitude', String(lng))
    const actualUsages = usageList
      .filter(u => u.productId && parseFloat(u.qty) > 0)
      .map(u => ({ productId: u.productId, actualUsage: parseFloat(u.qty) }))
      
    fd.append('usages', JSON.stringify(actualUsages))
    fd.append('photos', JSON.stringify(photos))

    start(async () => {
      const res = await submitContinueDemoPlot(id, fd)
      if (res?.error) { setError(res.error) }
      else router.push('/dashboard/demoplot')
    })
  }

  if (!reqData) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data demo plot...</div>

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>🌾 Lanjutkan Sesi Demo Plot</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Petani: <strong>{reqData.farmer?.name}</strong> · Area: {reqData.area} · Komoditas: {reqData.commodity}
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ padding: '0.9rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#1e40af' }}>
        ℹ️ Ini adalah <strong>sesi lanjutan</strong> dari demo plot sebelumnya. Centang &ldquo;Tandai sebagai sesi terakhir&rdquo; jika ini kunjungan terakhir.
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Session date */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📅 Detail Sesi Ini</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Tanggal Sesi <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="form-label">Luas Lahan</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" step="0.01" name="landSize" className="form-control" placeholder="0.5" style={{ flex: 2 }} />
                <select name="landSizeUnit" className="form-control" style={{ flex: 1, maxWidth: 130 }}>
                  <option value="ha">Hektare (ha)</option>
                  <option value="m2">Meter Persegi (m²)</option>
                </select>
              </div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Hasil Pengamatan &amp; Catatan</label>
              <textarea name="resultNotes" className="form-control" rows={3} placeholder="Hama mulai berkurang pada hari ke-3..." style={{ resize: 'none' }} />
            </div>
          </div>
        </div>

        {/* Product usage */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🧪 Penggunaan Produk Sesi Ini</h3>
          <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Stok akan dikurangi otomatis. Isi 0 jika tidak digunakan pada sesi ini.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {usageList.map((usage, idx) => {
              const selectedProduct = products.find(p => p.id === usage.productId)
              const onHand = selectedProduct ? stockBalance[selectedProduct.id] || 0 : 0
              
              return (
                <div key={usage.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 120px auto', gap: '0.75rem', alignItems: 'center', padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <select 
                      className="form-control"
                      value={usage.productId}
                      onChange={e => {
                        const newList = [...usageList]
                        newList[idx].productId = e.target.value
                        setUsageList(newList)
                      }}
                      required
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                    className="btn btn-outline"
                    style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: '#fecaca', background: '#fef2f2' }}
                    title="Hapus Produk"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
            
            <button 
              type="button" 
              onClick={() => setUsageList([...usageList, { id: Math.random().toString(36).substr(2, 9), productId: '', qty: '' }])}
              className="btn btn-outline" 
              style={{ padding: '0.75rem', borderStyle: 'dashed', borderWidth: '2px', background: 'transparent' }}
            >
              + Tambah Penggunaan Produk
            </button>
          </div>
        </div>

        {/* Documentation + GPS */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📷 Dokumentasi &amp; Lokasi</h3>
          <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />
          <div style={{ marginTop: '1rem' }}>
            <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} label="Upload Foto Sesi Ini" />
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>}

        {/* Submit Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" name="isFinalSession" value="true" style={{ width: '1.1rem', height: '1.1rem' }} />
            <span style={{ fontSize: '0.9rem' }}><strong>Tandai sebagai sesi terakhir</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(status akan menjadi Selesai)</span></span>
          </label>
          <button type="submit" className="btn btn-primary"
            style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
            disabled={isPending || lat === null}>
            {isPending ? 'Menyimpan...' : lat === null ? '📍 Ambil GPS Dulu' : '✅ Simpan Sesi Lanjutan'}
          </button>
        </div>
      </form>
    </div>
  )
}
