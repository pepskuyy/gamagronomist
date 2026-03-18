'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitStandaloneDemoPlot } from '@/app/actions/standalone-demoplot'
import ImageUploader from '@/components/ImageUploader'

type Product = { id: string; name: string; unit: string }
type CbFarmer = { id: string; farmerName: string; phone?: string; district?: string; address?: string; commodity?: string; constraints?: string }

export default function FoDemoPlotDirectPage() {
  const router = useRouter()
  const [products, setProducts]     = useState<Product[]>([])
  const [cbFarmers, setCbFarmers]   = useState<CbFarmer[]>([])
  const [stockBalance, setStock]    = useState<Record<string, number>>({})

  // Farmer state
  const [farmerMode, setFarmerMode] = useState<'cb' | 'manual'>('cb')
  const [selectedCb, setSelectedCb] = useState<CbFarmer | null>(null)
  const [farmerName, setFarmerName] = useState('')
  const [farmerPhone, setFarmerPhone] = useState('')
  const [area, setArea]             = useState('')
  const [commodity, setCommodity]   = useState('')
  const [problem, setProblem]       = useState('')
  const [plan, setPlan]             = useState('')

  // Product usage state
  const [usages, setUsages] = useState<Record<string, number>>({})

  // Session state
  const [latitude, setLatitude]   = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [photos, setPhotos]       = useState<string[]>([])
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts)
    fetch('/api/cb-farmers').then(r => r.json()).then(setCbFarmers)
    fetch('/api/stock/balance').then(r => r.json()).then((data: {productId:string; quantity:number}[]) => {
      const map: Record<string, number> = {}
      data.forEach(s => { map[s.productId] = s.quantity })
      setStock(map)
    }).catch(() => {})
  }, [])

  function selectCbFarmer(id: string) {
    const f = cbFarmers.find(x => x.id === id) || null
    setSelectedCb(f)
    if (f) {
      setFarmerName(f.farmerName || '')
      setFarmerPhone(f.phone || '')
      setArea(f.district || '')
      setCommodity(f.commodity || '')
      setProblem(f.constraints || '')
    }
  }

  function requestGPS() {
    if (!navigator.geolocation) { setGpsStatus('error'); return }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setGpsStatus('success') },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (gpsStatus !== 'success') { setError('Aktifkan GPS terlebih dahulu.'); return }
    if (!farmerName || !area || !commodity) { setError('Nama petani, area, dan komoditas wajib diisi.'); return }
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('farmerName', farmerName)
    fd.set('farmerPhone', farmerPhone)
    fd.set('area', area)
    fd.set('commodity', commodity)
    fd.set('problem', problem)
    fd.set('plan', plan)
    fd.append('latitude', String(latitude))
    fd.append('longitude', String(longitude))
    fd.append('usages', JSON.stringify(
      Object.entries(usages).filter(([, v]) => v > 0).map(([productId, actualUsage]) => ({ productId, actualUsage }))
    ))
    fd.append('photos', JSON.stringify(photos))

    start(async () => {
      const res = await submitStandaloneDemoPlot(fd)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/demoplot')
    })
  }

  const fc: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
  const gpsColor = { success: 'var(--success)', error: 'var(--danger)', loading: 'var(--warning)', idle: 'var(--border)' }[gpsStatus]

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>🌾 Rekam Realisasi Demo Plot</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Rekam langsung tanpa perlu membuat pengajuan terlebih dahulu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* ── FARMER SECTION ── */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>👤 Data Petani</h3>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button type="button" onClick={() => setFarmerMode('cb')}
              className={farmerMode === 'cb' ? 'btn btn-primary' : 'btn btn-outline'} style={{ flex: 1, fontSize: '0.85rem' }}>
              📋 Dari Database CB
            </button>
            <button type="button" onClick={() => { setFarmerMode('manual'); setSelectedCb(null); setFarmerName(''); setFarmerPhone(''); setArea(''); setCommodity(''); setProblem('') }}
              className={farmerMode === 'manual' ? 'btn btn-primary' : 'btn btn-outline'} style={{ flex: 1, fontSize: '0.85rem' }}>
              ✍️ Lainnya (Manual)
            </button>
          </div>

          {farmerMode === 'cb' && (
            <div style={fc}>
              <div>
                <label className="form-label">Pilih Petani dari CB <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={selectedCb?.id || ''} onChange={e => selectCbFarmer(e.target.value)} required={farmerMode === 'cb'}>
                  <option value="">-- Pilih petani dari database CB --</option>
                  {cbFarmers.map(f => (
                    <option key={f.id} value={f.id}>{f.farmerName} {f.district ? `— ${f.district}` : ''}</option>
                  ))}
                </select>
              </div>
              {selectedCb && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div><strong>Nama:</strong> {selectedCb.farmerName}</div>
                    <div><strong>No. HP:</strong> {selectedCb.phone || '-'}</div>
                    <div><strong>Kabupaten:</strong> {selectedCb.district || '-'}</div>
                    <div><strong>Komoditas:</strong> {selectedCb.commodity || '-'}</div>
                    {selectedCb.constraints && <div style={{ gridColumn: '1/-1' }}><strong>Kendala:</strong> {selectedCb.constraints}</div>}
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: 0 }}>✅ Data otomatis terisi dari database CB. Kamu bisa ubah jika perlu.</p>
                </div>
              )}
            </div>
          )}

          {/* Always show editable fields (pre-filled when CB selected) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: farmerMode === 'cb' ? '1rem' : 0 }}>
            <div>
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" value={farmerName} onChange={e => setFarmerName(e.target.value)} required placeholder="Bpk. Budi Santoso" />
            </div>
            <div>
              <label className="form-label">No. HP</label>
              <input className="form-control" value={farmerPhone} onChange={e => setFarmerPhone(e.target.value)} placeholder="0812xxx" />
            </div>
            <div>
              <label className="form-label">Area (Desa/Kecamatan) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" value={area} onChange={e => setArea(e.target.value)} required placeholder="Kec. Ngimbang" />
            </div>
            <div>
              <label className="form-label">Komoditas <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" value={commodity} onChange={e => setCommodity(e.target.value)} required placeholder="Padi / Jagung / Cabai" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Masalah / Kendala</label>
              <textarea className="form-control" rows={2} value={problem} onChange={e => setProblem(e.target.value)} placeholder="Hama wereng mengganas..." style={{ resize: 'none' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Rencana / Teknik Demo Plot</label>
              <textarea className="form-control" rows={2} value={plan} onChange={e => setPlan(e.target.value)} placeholder="Semprot 2x interval 1 minggu..." style={{ resize: 'none' }} />
            </div>
          </div>
        </div>

        {/* ── SESSION DETAILS ── */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📅 Detail Sesi</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Tanggal Sesi <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="form-label">Luas Lahan (Ha/M²)</label>
              <input type="number" step="0.01" name="landSize" className="form-control" placeholder="0.5" />
            </div>
          </div>

          {/* GPS */}
          <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', borderLeft: `4px solid ${gpsColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <strong>📍 Lokasi GPS</strong>{' '}
                {gpsStatus === 'success' && <span className="badge badge-success">Aktif</span>}
                {gpsStatus === 'loading' && <span className="badge badge-warning">Mencari...</span>}
                {gpsStatus === 'error' && <span className="badge badge-danger">Gagal</span>}
                {gpsStatus === 'idle' && <span className="badge badge-neutral">Belum Aktif</span>}
                {gpsStatus === 'success' && latitude && longitude && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem' }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--success)' }}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>{' '}
                    <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontSize: '0.78rem' }}>Lihat Maps ↗</a>
                  </p>
                )}
              </div>
              <button type="button" onClick={requestGPS} className={gpsStatus === 'success' ? 'btn btn-outline' : 'btn btn-primary'} disabled={gpsStatus === 'loading'} style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {gpsStatus === 'loading' ? '⏳ Mencari...' : gpsStatus === 'success' ? '🔄 Perbarui' : '📍 Aktifkan GPS'}
              </button>
            </div>
          </div>
        </div>

        {/* ── PRODUCT USAGE ── */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🧪 Penggunaan Produk</h3>
          <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>Masukkan jumlah produk yang digunakan pada sesi ini. Stok kamu akan dikurangi secara otomatis.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {products.map(p => {
              const onHand = stockBalance[p.id] || 0
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: onHand > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      Stok: <strong>{onHand} {p.unit}</strong>
                    </div>
                  </div>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-control"
                    style={{ width: 100, textAlign: 'right' }}
                    value={usages[p.id] || ''}
                    onChange={e => setUsages(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 30 }}>{p.unit}</span>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <label className="form-label">Hasil Pengamatan &amp; Catatan</label>
            <textarea name="resultNotes" className="form-control" rows={3} placeholder="Hama mulai berkurang pada hari ke-3..." style={{ resize: 'none' }} />
          </div>
        </div>

        {/* ── DOCUMENTATION ── */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📷 Dokumentasi</h3>
          <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} label="Upload Foto Realisasi Demo Plot" />
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>}

        {/* ── SUBMIT ROW ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" name="isFinalSession" value="true" style={{ width: '1.1rem', height: '1.1rem' }} />
            <span style={{ fontSize: '0.9rem' }}><strong>Tandai sebagai sesi terakhir</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(status akan menjadi Selesai)</span></span>
          </label>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
            disabled={isPending || gpsStatus !== 'success'}>
            {isPending ? 'Menyimpan...' : gpsStatus !== 'success' ? '📍 Aktifkan GPS Dulu' : '✅ Simpan Realisasi & Potong Stok'}
          </button>
        </div>
      </form>
    </div>
  )
}
