'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import RegionSelect from '@/components/RegionSelect'
import { submitCustomerBehavior } from '@/app/actions/report'

const OPT_TYPES = ['Hama', 'Penyakit', 'Gulma']
const OPT_DETAILS = [
  'Ulat grayak', 'Ulat buah', 'Ulat pelipat daun', 'Uret (ulat tanah)',
  'Sundep', 'Kutu', 'Tungau', 'Thrips', 'Wereng', 'Walang sangit',
  'Belalang', 'Lalat Buah', 'Keong', 'Burung', 'Tikus',
  'Jamur/ cendawan', 'Bakteri', 'Virus',
  'Berdaun lebar', 'Rumput - rumputan', 'Pakis - pakisan', 'Lulangan', 'Teki'
]

export default function NewCustomerBehaviorRef() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State for complex fields
  const [selectedOptTypes, setSelectedOptTypes] = useState<string[]>([])
  const [selectedOptDetails, setSelectedOptDetails] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])

  const toggleOptType = (type: string) => {
    setSelectedOptTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleOptDetail = (detail: string) => {
    setSelectedOptDetails(prev => 
      prev.includes(detail) ? prev.filter(d => d !== detail) : [...prev, detail]
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('optTypes', JSON.stringify(selectedOptTypes))
    formData.append('optDetails', JSON.stringify(selectedOptDetails))
    formData.append('photos', JSON.stringify(photos))

    const res = await submitCustomerBehavior(formData)
    
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
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>← Kembali</button>
        <h2 style={{ margin: 0 }}>Form Laporan Customer Behavior</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Profil Petani</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="farmerName" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Umur</label>
              <input type="text" name="age" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">No. HP</label>
              <input type="tel" name="phone" className="form-control" />
            </div>
            <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
              <RegionSelect nameKabupaten="district" nameKecamatan="districtKecamatan" nameDesa="districtDesa" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Detail Alamat (Jalan / RT / RW)</label>
              <textarea name="address" className="form-control" rows={2} placeholder="Samping masjid Al-Ikhlas..." />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Data Pertanian & Kendala</h3>
           
           <div className="form-grid">
             <div className="form-group">
               <label className="form-label">Komoditas</label>
               <input type="text" name="commodity" className="form-control" placeholder="Contoh: Padi, Jagung, Cabai" />
             </div>
             <div className="form-group" style={{ gridColumn: '1 / -1' }}>
               <label className="form-label">Alasan memilih komoditas</label>
               <input type="text" name="reasonChoice" className="form-control" />
             </div>
             <div className="form-group" style={{ gridColumn: '1 / -1' }}>
               <label className="form-label">Kendala yang dialami</label>
               <textarea name="constraints" className="form-control" rows={2} />
             </div>
           </div>

           <div className="form-group" style={{ marginTop: '1.5rem' }}>
             <label className="form-label">OPT (Pilih satu atau lebih)</label>
             <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
               {OPT_TYPES.map(type => (
                 <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: selectedOptTypes.includes(type) ? 'var(--primary-light)' : 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${selectedOptTypes.includes(type) ? 'var(--primary)' : 'var(--border)'}` }}>
                   <input 
                     type="checkbox" 
                     checked={selectedOptTypes.includes(type)}
                     onChange={() => toggleOptType(type)}
                     style={{ width: '1.25rem', height: '1.25rem' }}
                   />
                   <span>{type}</span>
                 </label>
               ))}
             </div>
           </div>

           <div className="form-group" style={{ marginTop: '1.5rem' }}>
             <label className="form-label">Detail OPT (Pilih satu atau lebih)</label>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
               {OPT_DETAILS.map(detail => (
                 <label key={detail} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                   <input 
                     type="checkbox" 
                     checked={selectedOptDetails.includes(detail)}
                     onChange={() => toggleOptDetail(detail)}
                   />
                   {detail}
                 </label>
               ))}
             </div>
           </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Preferensi Produk</h3>

           <div className="form-grid">
             <div className="form-group" style={{ gridColumn: '1 / -1' }}>
               <label className="form-label">Produk yang biasa digunakan petani (Biotis/Non-Biotis)</label>
               <input type="text" name="usedProducts" className="form-control" />
             </div>
             <div className="form-group">
               <label className="form-label">Kios tempat membeli</label>
               <input type="text" name="buyLocation" className="form-control" />
             </div>
             <div className="form-group">
               <label className="form-label">Alasan membeli produk</label>
               <input type="text" name="buyReason" className="form-control" />
             </div>
             <div className="form-group" style={{ gridColumn: '1 / -1' }}>
               <label className="form-label">Referensi yang biasa digunakan</label>
               <input type="text" name="references" className="form-control" placeholder="Contoh: Petugas PPL, Kios, Brosur" />
             </div>
             <div className="form-group" style={{ gridColumn: '1 / -1' }}>
               <label className="form-label">Catatan Tambahan (Opsional)</label>
               <textarea name="notes" className="form-control" rows={3} />
             </div>
           </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Dokumentasi</h3>
           <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} />
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Kirim Laporan Customer Behavior'}
          </button>
        </div>
      </form>
    </div>
  )
}
