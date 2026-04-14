'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitDemoPlotSession } from '@/app/actions/execute'
import ImageUploader from '@/components/ImageUploader'

type ApprovedProduct = {
  id: string
  productId: string
  name: string
  unit: string
  unitGramasi?: string | null
  qtyApproved: number
  stockOnHand: number
}

export default function ExecuteForm({ requestId, products }: { requestId: string, products: ApprovedProduct[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State for recording actual usage per product
  const [usages, setUsages] = useState<Record<string, number>>(
    products.reduce((acc, p) => ({ ...acc, [p.productId]: 0 }), {})
  )

  const handleUsageChange = (productId: string, val: string) => {
    setUsages({ ...usages, [productId]: Number(val) || 0 })
  }

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [gpsError, setGpsError] = useState<string | null>(null)

  // Photos State
  const [photos, setPhotos] = useState<string[]>([])

  // Request GPS location on mount
  useEffect(() => {
    requestGPS()
  }, [])

  function requestGPS() {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      setGpsError('Browser tidak mendukung GPS. Gunakan browser modern.')
      return
    }

    setGpsStatus('loading')
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setGpsStatus('success')
      },
      (err) => {
        setGpsStatus('error')
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError('Akses lokasi ditolak. Harap izinkan GPS untuk menyimpan realisasi.')
            break
          case err.POSITION_UNAVAILABLE:
            setGpsError('Informasi lokasi tidak tersedia. Pastikan GPS aktif.')
            break
          case err.TIMEOUT:
            setGpsError('Permintaan lokasi timeout. Coba lagi.')
            break
          default:
            setGpsError('Gagal mendapatkan lokasi.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (gpsStatus !== 'success' || latitude === null || longitude === null) {
      setError('Lokasi GPS wajib diaktifkan sebelum menyimpan realisasi. Klik tombol "Aktifkan GPS".')
      return
    }

    setLoading(true)
    setError(null)
    
    // Validate if usage exceeds Stock On Hand
    const overStockProduct = products.find(p => usages[p.productId] > p.stockOnHand)
    if (overStockProduct) {
      setError(`Penggunaan aktual untuk ${overStockProduct.name} melebihi Saldo Stok yang Anda miliki (${overStockProduct.stockOnHand} ${overStockProduct.unitGramasi || overStockProduct.unit}).`)
      setLoading(false)
      return
    }

    // Validate photo
    if (photos.length === 0) {
      setError('Dokumentasi foto wajib dilampirkan minimal 1 foto.')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.append('requestId', requestId)
    formData.append('latitude', latitude!.toString())
    formData.append('longitude', longitude!.toString())
    
    // Format usage into array
    const usageArray = Object.keys(usages).map(key => ({
      productId: key,
      actualUsage: usages[key]
    }))
    formData.append('usages', JSON.stringify(usageArray))
    formData.append('photos', JSON.stringify(photos))

    const res = await submitDemoPlotSession(formData)
    
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/demoplot')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-container-wide">
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.125rem' }}>Detail Sesi Demo Plot</h3>
        
        {error && <div className="alert-error" style={{ marginBottom: '1.5rem', color: 'var(--danger)', fontWeight: 500 }}>{error}</div>}

        {/* GPS Location Card */}
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-hover)',
          borderLeft: `4px solid ${gpsStatus === 'success' ? 'var(--success)' : gpsStatus === 'error' ? 'var(--danger)' : 'var(--warning)'}` 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📍 Lokasi GPS
                {gpsStatus === 'success' && <span className="badge badge-success">Aktif</span>}
                {gpsStatus === 'loading' && <span className="badge badge-warning">Mencari...</span>}
                {gpsStatus === 'error' && <span className="badge badge-danger">Gagal</span>}
                {gpsStatus === 'idle' && <span className="badge badge-neutral">Belum Aktif</span>}
              </h3>
              {gpsStatus === 'success' && latitude && longitude && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--success)' }}>
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </span>
                  {' '}
                  <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--secondary)', fontSize: '0.8rem' }}>Lihat di Maps ↗</a>
                </p>
              )}
              {gpsError && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--danger)' }}>⚠️ {gpsError}</p>}
            </div>
            {gpsStatus !== 'success' && (
              <button type="button" onClick={requestGPS} className="btn btn-primary" disabled={gpsStatus === 'loading'} style={{ whiteSpace: 'nowrap' }}>
                {gpsStatus === 'loading' ? '⏳ Mencari...' : '📍 Aktifkan GPS'}
              </button>
            )}
            {gpsStatus === 'success' && (
              <button type="button" onClick={requestGPS} className="btn btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>🔄 Perbarui Lokasi</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
           <div className="form-group">
              <label className="form-label">Tanggal Sesi</label>
              <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
           </div>
           <div className="form-group">
              <label className="form-label">Luas Lahan - Opsional</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" step="0.01" name="landSize" className="form-control" placeholder="Contoh: 0.5" style={{ flex: 2 }} />
                <select name="landSizeUnit" className="form-control" style={{ flex: 1, maxWidth: 130 }}>
                  <option value="ha">Hektare (ha)</option>
                  <option value="m2">Meter Persegi (m²)</option>
                </select>
              </div>
           </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Penggunaan Produk (Actual Usage)</h3>
        <div className="table-responsive" style={{ marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
             <thead style={{ background: 'var(--surface-hover)' }}>
               <tr>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Qty Approved</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Saldo FO Saat Ini</th>
                 <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', width: '200px' }}>Actual Usage Sesi Ini</th>
               </tr>
             </thead>
             <tbody>
               {products.map(p => (
                 <tr key={p.productId}>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{p.qtyApproved} {p.unitGramasi || p.unit}</td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                     <span style={{ fontWeight: 600, color: p.stockOnHand > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                       {p.stockOnHand} {p.unitGramasi || p.unit}
                     </span>
                   </td>
                   <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01" 
                          className="form-control" 
                          style={{ padding: '0.4rem', margin: 0 }}
                          value={usages[p.productId]}
                          onChange={(e) => handleUsageChange(p.productId, e.target.value)}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.unitGramasi || p.unit}</span>
                      </div>
                   </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
           <label className="form-label">Hasil Pengamatan & Catatan <span style={{ color: 'var(--danger)' }}>*</span></label>
           <textarea name="resultNotes" className="form-control" rows={3} placeholder="Hama mulai terlihat berkurang pada hari ke-3" required />
        </div>

        <div style={{ marginBottom: '2rem' }}>
           <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Dokumentasi Realisasi <span style={{ color: 'var(--danger)' }}>*</span></h3>
           <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Minimal 1 foto wajib dilampirkan.</p>
           <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} label="Upload Bukti Dokumentasi Realisasi" />
        </div>

        <div className="checkbox-action-row" style={{ marginTop: '2rem' }}>
           <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1, padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
             <input type="checkbox" name="isFinalSession" value="true" style={{ width: '1.25rem', height: '1.25rem' }} />
             <div>
               <strong>Tandai sebagai sesi terakhir</strong>
               <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(akan mengubah status request menjadi Selesai)</div>
             </div>
           </label>

           <button type="submit" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }} disabled={loading || gpsStatus !== 'success'}>
              {loading ? 'Menyimpan...' : gpsStatus !== 'success' ? '📍 Aktifkan GPS Terlebih Dahulu' : 'Simpan Realisasi & Potong Stok'}
           </button>
        </div>
      </div>
    </form>
  )
}
