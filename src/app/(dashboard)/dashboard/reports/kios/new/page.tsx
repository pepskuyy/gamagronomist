'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import GpsCapture from '@/components/GpsCapture'
import { submitVisitKios } from '@/app/actions/report'

export default function NewVisitKios() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (lat === null || lng === null) { setError('Lokasi GPS wajib diambil sebelum mengirim laporan.'); setLoading(false); return }

    const formData = new FormData(e.currentTarget)
    formData.append('photos', JSON.stringify(photos))
    formData.append('latitude', String(lat))
    formData.append('longitude', String(lng))

    const res = await submitVisitKios(formData)
    
    if (res?.error) {
       setError(res.error)
       setLoading(false)
    } else {
       router.push('/dashboard/reports')
    }
  }

  return (
    <div className="form-container">
      <div className="back-header">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>← Kembali</button>
        <h2 style={{ margin: 0 }}>Form Visit Kios</h2>
      </div>

      <form onSubmit={handleSubmit} className="card">
         <div className="form-group">
            <label className="form-label">Nama Kios <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" name="kiosName" className="form-control" required placeholder="Pilih atau Ketik Nama Kios" />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>*Fitur Dropdown Kios (Master Kios) dapat menyusul, sementara free-text.</div>
         </div>
         
         <div className="form-group">
            <label className="form-label">Detail Aktivitas <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea name="activityDetail" className="form-control" rows={3} required placeholder="Jelaskan aktivitas yang dilakukan saat kunjungan" />
         </div>
         
         <div className="form-group">
            <label className="form-label">Hasil Kunjungan <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea name="visitResult" className="form-control" rows={3} required placeholder="Catat hasil dari kunjungan (misal: order bertambah, stok menipis, dll)" />
         </div>

         <div className="form-group">
            <label className="form-label">Catatan (Opsional)</label>
            <textarea name="notes" className="form-control" rows={2} />
         </div>

         <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />

         <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} />

         {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

         <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
           <button type="submit" className="btn btn-primary" disabled={loading || lat === null}>
             {loading ? 'Menyimpan...' : lat === null ? '📍 Ambil Lokasi Dulu' : 'Kirim Laporan Visit Kios'}
          </button>
         </div>
      </form>
    </div>
  )
}
