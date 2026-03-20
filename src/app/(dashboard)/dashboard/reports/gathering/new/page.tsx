'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import GpsCapture from '@/components/GpsCapture'
import { submitFarmerGathering } from '@/app/actions/report'

export default function NewFarmerGathering() {
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

    const res = await submitFarmerGathering(formData)
    
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
        <h2 style={{ margin: 0 }}>Form Farmer Gathering</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Informasi Kelompok Tani</h3>
          
          <div className="form-group">
            <label className="form-label">Nama Ketua Kelompok Tani <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" name="leaderName" className="form-control" required />
          </div>
          <div className="form-group">
            <label className="form-label">No. HP Ketua</label>
            <input type="tel" name="phone" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Kabupaten/Kota <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" name="district" className="form-control" required />
          </div>
          <div className="form-group">
            <label className="form-label">Alamat Lengkap (Desa/Kecamatan)</label>
            <textarea name="address" className="form-control" rows={2} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Detail Kegiatan</h3>
          
          <div className="form-group">
            <label className="form-label">Detail Aktivitas <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea name="activityDetail" className="form-control" rows={4} required placeholder="Jelaskan apa saja yang dilakukan selama gathering, produk apa yang didemonstrasikan, dll." />
          </div>
          <div className="form-group">
            <label className="form-label">Keseluruhan Biaya Kegiatan (Rp)</label>
            <input type="number" name="cost" className="form-control" placeholder="Contoh: 1500000" />
          </div>
          <div className="form-group">
            <label className="form-label">Rincian Biaya (Detail)</label>
            <textarea name="costDetail" className="form-control" rows={3} placeholder="Makan siang: Rp 500.000, Sewa Tenda: Rp 1.000.000" />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Dokumentasi</h3>
           <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />
           <div style={{ marginTop: '1rem' }}>
             <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} />
           </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
           <button type="submit" className="btn btn-primary" disabled={loading || lat === null}>
             {loading ? 'Menyimpan...' : lat === null ? '📍 Ambil Lokasi Dulu' : 'Kirim Laporan Gathering'}
          </button>
        </div>
      </form>
    </div>
  )
}
