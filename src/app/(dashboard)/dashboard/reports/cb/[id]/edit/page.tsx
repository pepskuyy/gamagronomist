'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateCustomerBehavior } from '@/app/actions/cb-admin'

export default function EditCustomerBehavior({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State for form fields
  const [data, setData] = useState<any>(null)
  const [hasPhone, setHasPhone] = useState(true)

  useEffect(() => {
    // Fetch existing report
    fetch(`/api/reports/cb/${params.id}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setData(d)
          setHasPhone(!!d.phone)
        }
        setLoading(false)
      })
      .catch(err => {
        setError('Gagal memuat data')
        setLoading(false)
      })
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const res = await updateCustomerBehavior(params.id, formData)
    if (res?.error) {
      setError(res.error)
      setSaving(false)
    } else {
      router.push(`/dashboard/reports/cb/${params.id}`)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat form edit...</div>
  if (error && !data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
  if (!data) return null

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href={`/dashboard/reports/cb/${params.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '1rem' }}>← Batal</Link>
        <h2 style={{ margin: 0 }}>Edit Customer Behavior</h2>
      </div>

      {error && <div className="alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>👤 Profil Petani</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="farmerName" className="form-control" required defaultValue={data.farmerName || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Umur</label>
              <input type="text" name="age" className="form-control" defaultValue={data.age || ''} inputMode="numeric" pattern="[0-9]*" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }} placeholder="contoh: 40" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Apakah Petani Memiliki No. HP?</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="hasPhoneToggle" value="yes" checked={hasPhone} onChange={() => setHasPhone(true)} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Ya, Punya</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="hasPhoneToggle" value="no" checked={!hasPhone} onChange={() => setHasPhone(false)} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Tidak Punya</span>
                </label>
              </div>
            </div>
            
            {hasPhone && (
              <div className="form-group">
                <label className="form-label">No. HP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="tel" name="phone" className="form-control" defaultValue={data.phone || ''} required pattern="[0-9]+" title="Hanya angka" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Kabupaten/Kota Area</label>
              <input type="text" name="district" className="form-control" defaultValue={data.district || ''} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Alamat Lengkap</label>
              <textarea name="address" className="form-control" rows={2} defaultValue={data.address || ''} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>🌾 Data Pertanian &amp; Kendala</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Komoditas</label>
              <input type="text" name="commodity" className="form-control" defaultValue={data.commodity || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Alasan Pilih</label>
              <input type="text" name="reasonChoice" className="form-control" defaultValue={data.reasonChoice || ''} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Kendala yang dialami (selain opt)</label>
              <textarea name="constraints" className="form-control" rows={2} defaultValue={data.constraints || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Jenis OPT (pisahkan dengan koma)</label>
              <input type="text" name="optTypes" className="form-control" defaultValue={data.optTypes || ''} />
              <small style={{ color: 'var(--text-muted)' }}>Contoh: Hama,Penyakit</small>
            </div>
            <div className="form-group">
              <label className="form-label">Detail OPT (pisahkan dengan koma)</label>
              <input type="text" name="optDetails" className="form-control" defaultValue={data.optDetails || ''} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>🛒 Preferensi Produk</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Produk Preferensi</label>
              <input type="text" name="usedProducts" className="form-control" defaultValue={data.usedProducts || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Lokasi Beli</label>
              <input type="text" name="buyLocation" className="form-control" defaultValue={data.buyLocation || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Alasan Beli</label>
              <input type="text" name="buyReason" className="form-control" defaultValue={data.buyReason || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Referensi</label>
              <input type="text" name="references" className="form-control" defaultValue={data.references || ''} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Catatan</label>
              <textarea name="notes" className="form-control" rows={3} defaultValue={data.notes || ''} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <Link href={`/dashboard/reports/cb/${params.id}`} className="btn btn-outline">Batal</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}
