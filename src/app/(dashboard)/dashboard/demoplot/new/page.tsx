'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitStandaloneDemoPlot } from '@/app/actions/standalone-demoplot'
import ImageUploader from '@/components/ImageUploader'
import RegionSelect from '@/components/RegionSelect'
import SearchableSelect from '@/components/SearchableSelect'

type Product = { id: string; name: string; unit: string; unitGramasi?: string | null; gramasiPerUnit?: number | null }
type CbFarmer = { id: string; farmerName: string; phone?: string; district?: string; location?: string; address?: string; commodity?: string; constraints?: string }

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
  const [hasPhone, setHasPhone]     = useState(true)

  // Product usage state
  const [usageList, setUsageList] = useState<{ id: string, productId: string, qty: string, usedFarmerProduct: boolean }[]>([])

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
      setHasPhone(!!f.phone)
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
    
    // Convert dynamic list back to expected payload: { productId, actualUsage }
    const actualUsages = usageList
      .filter(u => u.productId && parseFloat(u.qty) > 0)
      .map(u => ({ productId: u.productId, actualUsage: parseFloat(u.qty), usedFarmerProduct: u.usedFarmerProduct }))
      
    fd.append('usages', JSON.stringify(actualUsages))
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
                <SearchableSelect
                  options={[
                    ...cbFarmers.map(f => ({
                      value: f.id,
                      label: `${f.farmerName} ${f.location ? `— ${f.location}` : ''}`
                    }))
                  ]}
                  value={selectedCb?.id || ''}
                  onChange={selectCbFarmer}
                  placeholder="-- Ketik nama petani / area --"
                  required={farmerMode === 'cb'}
                />
              </div>
              {selectedCb && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div><strong>Nama:</strong> {selectedCb.farmerName}</div>
                    <div><strong>No. HP:</strong> {selectedCb.phone || '-'}</div>
                    <div><strong>Desa/Kecamatan:</strong> {selectedCb.location || '-'}</div>
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
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Apakah Petani Memiliki No. HP?</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" value="yes" checked={hasPhone} onChange={() => setHasPhone(true)} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Ya, Punya</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" value="no" checked={!hasPhone} onChange={() => { setHasPhone(false); setFarmerPhone(''); }} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Tidak Punya</span>
                </label>
              </div>
            </div>
            {hasPhone && (
              <div>
                <label className="form-label">No. HP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="tel" className="form-control" value={farmerPhone} onChange={e => setFarmerPhone(e.target.value)} required pattern="[0-9]+" title="Hanya angka" placeholder="0812xxx" />
              </div>
            )}
            {farmerMode === 'manual' && (
              <div style={{ gridColumn: '1/-1' }}>
                <RegionSelect onChangeFullString={setArea} />
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Area yang akan disimpan: <strong>{area || '-'}</strong>
                </p>
              </div>
            )}
            <div>
              <label className="form-label">Komoditas <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" value={commodity} onChange={e => setCommodity(e.target.value)} required placeholder="Padi / Jagung / Cabai" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Masalah / Kendala</label>
              <textarea className="form-control" rows={2} value={problem} onChange={e => setProblem(e.target.value)} placeholder="Hama wereng mengganas..." style={{ resize: 'none' }} />
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
              <label className="form-label">Luas Lahan</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" step="0.01" name="landSize" className="form-control" placeholder="0.5" style={{ flex: 2 }} />
                <select name="landSizeUnit" className="form-control" style={{ flex: 1, maxWidth: 130 }}>
                  <option value="ha">Hektare (ha)</option>
                  <option value="m2">Meter Persegi (m²)</option>
                </select>
              </div>
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
          <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>Pilih produk yang digunakan dan masukkan jumlahnya. Stok kamu akan dikurangi secara otomatis.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {usageList.map((usage, idx) => {
              const isFarmer = usage.usedFarmerProduct
              const selectedProduct = products.find(p => p.id === usage.productId)
              const onHand = selectedProduct ? stockBalance[selectedProduct.id] || 0 : 0
              const availableProducts = isFarmer
                ? products
                : products.filter(p => (stockBalance[p.id] || 0) > 0)
              
              return (
                <div key={usage.id} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: isFarmer ? '#fefce8' : 'var(--surface-2)', border: `1px solid ${isFarmer ? '#fde68a' : 'var(--border)'}` }}>
                  {/* Toggle sumber produk */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => { const nl = [...usageList]; nl[idx].usedFarmerProduct = false; nl[idx].productId = ''; setUsageList(nl) }}
                      style={{ flex: 1, padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: !isFarmer ? '2px solid var(--primary)' : '1px solid var(--border)', background: !isFarmer ? 'var(--primary-light)' : 'transparent', color: !isFarmer ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.15s' }}
                    >
                      🏢 Stok Sendiri
                    </button>
                    <button
                      type="button"
                      onClick={() => { const nl = [...usageList]; nl[idx].usedFarmerProduct = true; nl[idx].productId = ''; setUsageList(nl) }}
                      style={{ flex: 1, padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: isFarmer ? '2px solid #d97706' : '1px solid var(--border)', background: isFarmer ? '#fef3c7' : 'transparent', color: isFarmer ? '#92400e' : 'var(--text-muted)', transition: 'all 0.15s' }}
                    >
                      🌾 Produk Petani
                    </button>
                  </div>
                  {isFarmer && (
                    <p style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.5rem', background: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                      ⚠️ Produk milik petani — <strong>tidak memotong stok Anda</strong>
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 120px auto', gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <SearchableSelect
                        options={availableProducts.map(p => ({ value: p.id, label: p.name }))}
                        value={usage.productId}
                        onChange={val => {
                          const newList = [...usageList]
                          newList[idx].productId = val
                          setUsageList(newList)
                        }}
                        placeholder={isFarmer ? '-- Pilih Produk Petani --' : '-- Cari Produk --'}
                        required
                      />
                      {selectedProduct && !isFarmer && (
                        <div style={{ fontSize: '0.78rem', color: onHand > 0 ? 'var(--primary)' : 'var(--text-muted)', marginTop: '0.4rem' }}>
                          Tersedia: <strong>{onHand} {selectedProduct.unitGramasi || selectedProduct.unit}</strong>
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
                      {selectedProduct && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{selectedProduct.unitGramasi || selectedProduct.unit}</span>}
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
                </div>
              )
            })}
            
            <button 
              type="button" 
              onClick={() => setUsageList([...usageList, { id: Math.random().toString(36).substr(2, 9), productId: '', qty: '', usedFarmerProduct: false }])}
              className="btn btn-outline" 
              style={{ padding: '0.75rem', borderStyle: 'dashed', borderWidth: '2px', background: 'transparent' }}
            >
              + Tambah Penggunaan Produk
            </button>
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
