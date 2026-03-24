'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateDemoPlot } from '@/app/actions/demoplot-admin'

export default function EditDemoPlot({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/reports/demoplot/${params.id}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
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
    const res = await updateDemoPlot(params.id, formData)
    if (res?.error) {
      setError(res.error)
      setSaving(false)
    } else {
      router.push(`/dashboard/demoplot/detail/${data.requestId}`)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat form edit...</div>
  if (error && !data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
  if (!data) return null

  return (
    <div className="form-container">
      <div className="back-header">
        <Link href={`/dashboard/demoplot/detail/${data.requestId}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '1rem' }}>← Batal</Link>
        <h2 style={{ margin: 0 }}>Edit Demo Plot</h2>
      </div>

      {error && <div className="alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Data Laporan</h3>

        <div className="form-group">
          <label className="form-label">Tanggal</label>
          <input type="date" name="date" className="form-control" required defaultValue={data.formattedDate} />
        </div>

        <div className="form-group">
          <label className="form-label">Nama Petani <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.8rem' }}>(Tidak dapat diubah manual di sini)</span></label>
          <input type="text" className="form-control" readOnly disabled value={data.farmerName || '-'} />
        </div>

        <div className="form-group">
          <label className="form-label">Area / Desa</label>
          <input type="text" name="area" className="form-control" defaultValue={data.area || ''} />
        </div>

        <div className="form-group">
          <label className="form-label">Komoditas</label>
          <input type="text" name="commodity" className="form-control" defaultValue={data.commodity || ''} />
        </div>

        <div className="form-group">
          <label className="form-label">Luas Lahan (m²)</label>
          <input type="number" step="0.01" name="landSize" className="form-control" defaultValue={data.landSize || ''} />
        </div>

        <div className="form-group">
          <label className="form-label">Catatan Hasil / Keterangan</label>
          <textarea name="resultNotes" className="form-control" rows={3} defaultValue={data.resultNotes || ''} />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '0.5rem' }}>
          <input 
            type="checkbox" 
            id="isFinalSession" 
            name="isFinalSession" 
            defaultChecked={data.isFinalSession} 
            style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <label htmlFor="isFinalSession" style={{ fontWeight: 600, cursor: 'pointer', margin: 0, color: 'var(--text)' }}>
            Tandai sebagai Sesi Terakhir (Selesai)
          </label>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <Link href={`/dashboard/demoplot/detail/${data.requestId}`} className="btn btn-outline">Batal</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}
