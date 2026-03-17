'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import { submitVisitCompany } from '@/app/actions/report'

const COMMODITIES = [
  'Cabai', 'Bawang Merah', 'Padi', 'Jagung', 'Tomat', 'Semangka', 'Tembakau', 'Lainnya'
]

const PAYMENT_TERMS = [
  'COD', 'CBD', 'TOP<30 HARI', 'TOP>30 HARI'
]

export default function NewVisitCompany() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])

  const toggleCommodity = (commodity: string) => {
    setSelectedCommodities(prev => 
      prev.includes(commodity) ? prev.filter(c => c !== commodity) : [...prev, commodity]
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('commodities', JSON.stringify(selectedCommodities))
    formData.append('photos', JSON.stringify(photos))

    const res = await submitVisitCompany(formData)
    
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
        <h2 style={{ margin: 0 }}>Form Visit Company / Corporate Farming</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Informasi Perusahaan</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Perusahaan <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="companyName" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Kabupaten/Kota</label>
              <input type="text" name="district" className="form-control" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Alamat Lengkap</label>
              <textarea name="address" className="form-control" rows={2} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Data Kontak & PIC</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama PIC <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="picName" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Jabatan PIC</label>
              <input type="text" name="picPosition" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">No. HP PIC</label>
              <input type="tel" name="picPhone" className="form-control" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Data Lahan & Prospek</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Luas Area (Ha)</label>
              <input type="number" step="0.01" name="landArea" className="form-control" placeholder="Contoh: 10.5" />
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Komoditas yang ditanam (Pilih satu atau lebih)</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {COMMODITIES.map(commodity => (
                  <label key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: selectedCommodities.includes(commodity) ? 'var(--primary-light)' : 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${selectedCommodities.includes(commodity) ? 'var(--primary)' : 'var(--border)'}` }}>
                    <input 
                      type="checkbox" 
                      checked={selectedCommodities.includes(commodity)}
                      onChange={() => toggleCommodity(commodity)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span>{commodity}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Produk yang prospek/ditawarkan</label>
              <textarea name="products" className="form-control" rows={2} placeholder="Sebutkan produk Gamagronomist yang berpotensi dipakai" />
            </div>

            <div className="form-group">
              <label className="form-label">Rencana Tgl Pengadaan Barang</label>
              <input type="date" name="procurementDate" className="form-control" />
            </div>

            <div className="form-group">
              <label className="form-label">Termin Pembayaran</label>
              <select name="paymentTerm" className="form-control">
                <option value="">-- Pilih Termin --</option>
                {PAYMENT_TERMS.map(term => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Dokumentasi</h3>
           <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} />
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Kirim Laporan Visit Company'}
          </button>
        </div>
      </form>
    </div>
  )
}
