'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createArea, deleteArea, createFarmer, deleteFarmer, bulkDeleteAreas, bulkDeleteFarmers } from '@/app/actions/master'

type Coverage = { id: string; kabupatenName: string }
type Area = { id: string; name: string; users: { id: string; name: string; role: string }[] }
type Farmer = { id: string; name: string; phone: string | null; address: string | null; area: string | null; createdAt: string }

const tdStyle: React.CSSProperties = { padding: '0.7rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }
const thStyle: React.CSSProperties = { padding: '0.7rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-hover)' }
const chkTd: React.CSSProperties = { ...tdStyle, width: '40px', textAlign: 'center' }
const chkTh: React.CSSProperties = { ...thStyle, width: '40px', textAlign: 'center' }

export default function AreasPage() {
  const [areas,   setAreas]   = useState<Area[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)

  const [areaName, setAreaName] = useState('')
  const [areaError, setAreaError] = useState<string | null>(null)
  const [isPendingArea, startArea] = useTransition()

  const [showFarmerForm, setShowFarmerForm] = useState(false)
  const [farmerError, setFarmerError] = useState<string | null>(null)
  const [isPendingFarmer, startFarmer] = useTransition()

  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set())

  // Coverage panel state
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(null)
  const [coverages, setCoverages] = useState<Record<string, Coverage[]>>({})
  const [newKab, setNewKab] = useState('')
  const [kabError, setKabError] = useState<string | null>(null)
  const [isPendingKab, startKab] = useTransition()

  // Geocode test tool state
  const [testLat, setTestLat] = useState('')
  const [testLng, setTestLng] = useState('')
  const [testResult, setTestResult] = useState<{ resolvedKabupaten: string | null; nominatim: Record<string, string | null> } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const fetchData = async () => {
    const [aRes, fRes] = await Promise.all([
      fetch('/api/master/areas'),
      fetch('/api/master/farmers'),
    ])
    if (aRes.ok) setAreas(await aRes.json())
    if (fRes.ok) setFarmers(await fRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function loadCoverage(areaId: string) {
    const res = await fetch(`/api/master/area-coverage?areaId=${areaId}`)
    if (res.ok) {
      const data = await res.json()
      setCoverages(prev => ({ ...prev, [areaId]: data }))
    }
  }

  function toggleCoveragePanel(areaId: string) {
    if (expandedAreaId === areaId) {
      setExpandedAreaId(null)
    } else {
      setExpandedAreaId(areaId)
      setNewKab('')
      setKabError(null)
      setTestResult(null)
      setTestError(null)
      setTestLat('')
      setTestLng('')
      loadCoverage(areaId)
    }
  }

  async function handleTestGeocode() {
    const lat = parseFloat(testLat)
    const lng = parseFloat(testLng)
    if (isNaN(lat) || isNaN(lng)) { setTestError('Masukkan koordinat yang valid.'); return }
    setTestLoading(true)
    setTestResult(null)
    setTestError(null)
    try {
      const res = await fetch(`/api/admin/geocode-test?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (!res.ok) { setTestError(data.error); return }
      setTestResult(data)
    } catch (e: any) {
      setTestError(e.message)
    } finally {
      setTestLoading(false)
    }
  }

  function handleAddKabupaten(areaId: string) {
    if (!newKab.trim()) return
    setKabError(null)
    startKab(async () => {
      const res = await fetch('/api/master/area-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, kabupatenName: newKab.trim() })
      })
      const data = await res.json()
      if (!res.ok) { setKabError(data.error); return }
      setNewKab('')
      await loadCoverage(areaId)
    })
  }

  function handleDeleteKabupaten(areaId: string, covId: string) {
    if (!confirm('Hapus kabupaten/kota ini dari coverage?')) return
    startKab(async () => {
      await fetch('/api/master/area-coverage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: covId })
      })
      await loadCoverage(areaId)
    })
  }

  function handleAddArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setAreaError(null)
    startArea(async () => {
      const res = await createArea(fd)
      if (res?.error) { setAreaError(res.error) }
      else { setAreaName(''); fetchData() }
    })
  }

  function handleDeleteArea(id: string) {
    if (!confirm('Hapus area ini?')) return
    startArea(async () => {
      const res = await deleteArea(id)
      if (res?.error) alert(res.error)
      else fetchData()
    })
  }

  function handleBulkDeleteAreas() {
    if (!selectedAreas.size) return
    if (!confirm(`Hapus ${selectedAreas.size} area? Tidak bisa dibatalkan.`)) return
    startArea(async () => {
      const res = await bulkDeleteAreas(Array.from(selectedAreas))
      if (res?.error) alert(res.error)
      else { setSelectedAreas(new Set()); fetchData() }
    })
  }

  function handleAddFarmer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setFarmerError(null)
    startFarmer(async () => {
      const res = await createFarmer(fd)
      if (res?.error) { setFarmerError(res.error) }
      else { setShowFarmerForm(false); fetchData();(e.currentTarget as HTMLFormElement)?.reset() }
    })
  }

  function handleDeleteFarmer(id: string) {
    if (!confirm('Hapus data petani ini?')) return
    startFarmer(async () => {
      const res = await deleteFarmer(id)
      if (res?.error) alert(res.error)
      else fetchData()
    })
  }

  function handleBulkDeleteFarmers() {
    if (!selectedFarmers.size) return
    if (!confirm(`Hapus ${selectedFarmers.size} petani? Tidak bisa dibatalkan.`)) return
    startFarmer(async () => {
      const res = await bulkDeleteFarmers(Array.from(selectedFarmers))
      if (res?.error) alert(res.error)
      else { setSelectedFarmers(new Set()); fetchData() }
    })
  }

  function toggleArea(id: string) {
    setSelectedAreas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllAreas(checked: boolean) {
    setSelectedAreas(checked ? new Set(areas.map(a => a.id)) : new Set())
  }
  function toggleFarmer(id: string) {
    setSelectedFarmers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllFarmers(checked: boolean) {
    setSelectedFarmers(checked ? new Set(farmers.map(f => f.id)) : new Set())
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
        <h2 style={{ margin: 0 }}>🗺️ Area &amp; Petani</h2>
      </div>

      {/* ─── AREA SECTION ─── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Wilayah Area Operasional</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Klik <strong>⚙️ Coverage</strong> untuk mengatur kabupaten/kota yang masuk wilayah area tersebut.
          Digunakan untuk klasifikasi otomatis aktivitas berdasarkan koordinat GPS.
        </p>

        <form onSubmit={handleAddArea} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input name="name" type="text" className="form-control" placeholder="Nama area baru, misal: TGH1" value={areaName} onChange={e => setAreaName(e.target.value)} style={{ flex: 1, minWidth: '200px' }} required />
          <button type="submit" className="btn btn-primary" disabled={isPendingArea}>{isPendingArea ? 'Menyimpan...' : '➕ Tambah Area'}</button>
        </form>
        {areaError && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{areaError}</div>}

        {selectedAreas.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedAreas.size} area dipilih</span>
            <button onClick={handleBulkDeleteAreas} disabled={isPendingArea} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>🗑️ Hapus yang Dipilih</button>
            <button onClick={() => setSelectedAreas(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
          </div>
        )}

        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={chkTh}><input type="checkbox" checked={areas.length > 0 && selectedAreas.size === areas.length} onChange={e => toggleAllAreas(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} /></th>
                <th style={thStyle}>Nama Area</th>
                <th style={thStyle}>Anggota</th>
                <th style={{ ...thStyle, width: '130px' }}>Coverage GPS</th>
                <th style={{ ...thStyle, width: '60px' }}>Hapus</th>
              </tr>
            </thead>
            <tbody>
              {areas.map(a => (
                <>
                  <tr key={a.id} style={{ background: expandedAreaId === a.id ? 'var(--surface-hover)' : selectedAreas.has(a.id) ? 'var(--primary-light)' : undefined }}>
                    <td style={chkTd}><input type="checkbox" checked={selectedAreas.has(a.id)} onChange={() => toggleArea(a.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} /></td>
                    <td style={tdStyle}><strong>{a.name}</strong></td>
                    <td style={tdStyle}>
                      <span className="badge badge-neutral">{a.users.length} user</span>
                      {a.users.slice(0, 3).map(u => (
                        <span key={u.id} style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.name} ({u.role})</span>
                      ))}
                      {a.users.length > 3 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{a.users.length - 3} lainnya</span>}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleCoveragePanel(a.id)}
                        className={expandedAreaId === a.id ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                      >
                        ⚙️ Coverage{coverages[a.id] ? ` (${coverages[a.id].length})` : ''}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => handleDeleteArea(a.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem' }} title="Hapus">🗑️</button>
                    </td>
                  </tr>
                  {expandedAreaId === a.id && (
                    <tr key={`cov-${a.id}`}>
                      <td colSpan={5} style={{ padding: 0, borderBottom: '2px solid var(--primary)' }}>
                        <div style={{ background: 'var(--primary-light)', padding: '1rem 1.5rem' }}>
                          <p style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--primary)' }}>
                            📍 Coverage Kabupaten/Kota — {a.name}
                          </p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                            Aktivitas dengan GPS di kabupaten/kota berikut akan otomatis masuk area <strong>{a.name}</strong>.
                          </p>

                          {/* ── Geocode Test Tool ── */}
                          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                            <p style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                              🔍 Uji Koordinat — Pastikan nama kabupaten/kota sesuai
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                              Buka Google Maps → klik lokasi → salin koordinat, lalu paste di sini untuk melihat nama yang harus digunakan.
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Latitude</label>
                                <input
                                  className="form-control"
                                  placeholder="-7.0051"
                                  value={testLat}
                                  onChange={e => setTestLat(e.target.value)}
                                  style={{ width: '130px', fontSize: '0.82rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Longitude</label>
                                <input
                                  className="form-control"
                                  placeholder="110.4381"
                                  value={testLng}
                                  onChange={e => setTestLng(e.target.value)}
                                  style={{ width: '130px', fontSize: '0.82rem' }}
                                />
                              </div>
                              <button
                                onClick={handleTestGeocode}
                                disabled={testLoading || !testLat.trim() || !testLng.trim()}
                                className="btn btn-outline"
                                style={{ fontSize: '0.82rem' }}
                              >
                                {testLoading ? '⏳ Mengecek...' : '🔍 Cek'}
                              </button>
                            </div>
                            {testError && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.4rem' }}>{testError}</p>}
                            {testResult && (
                              <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.85rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                                <p style={{ fontWeight: 700, color: '#166534', marginBottom: '0.3rem' }}>✅ Hasil:</p>
                                {testResult.resolvedKabupaten
                                  ? (
                                    <>
                                      <p>Nama yang harus digunakan di Coverage:</p>
                                      <code style={{ display: 'inline-block', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d', cursor: 'pointer', marginTop: '0.2rem' }}
                                        onClick={() => setNewKab(testResult.resolvedKabupaten!)}
                                        title="Klik untuk isi ke input di bawah"
                                      >
                                        {testResult.resolvedKabupaten} &nbsp;← klik untuk isi otomatis
                                      </code>
                                      <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.75rem' }}>
                                        Raw Nominatim: county={testResult.nominatim.county || '-'}, city={testResult.nominatim.city || '-'}
                                      </p>
                                    </>
                                  )
                                  : (
                                    <p style={{ color: '#b91c1c' }}>⚠️ Kabupaten tidak terdeteksi untuk koordinat ini. Raw: county={testResult.nominatim.county || '-'}, city={testResult.nominatim.city || '-'}</p>
                                  )
                                }
                              </div>
                            )}
                          </div>

                          {/* ── Add kabupaten ── */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <input
                              className="form-control"
                              placeholder="contoh: kabupaten grobogan"
                              value={newKab}
                              onChange={e => setNewKab(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKabupaten(a.id) } }}
                              style={{ flex: 1, minWidth: '260px', fontSize: '0.875rem' }}
                            />
                            <button onClick={() => handleAddKabupaten(a.id)} disabled={isPendingKab || !newKab.trim()} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                              {isPendingKab ? 'Menambahkan...' : '+ Tambah'}
                            </button>
                          </div>
                          {kabError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{kabError}</p>}
                          {(coverages[a.id] ?? []).length === 0
                            ? <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada kabupaten/kota yang dikonfigurasi.</p>
                            : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {(coverages[a.id] ?? []).map(cov => (
                                  <span key={cov.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'white', border: '1px solid var(--primary)', borderRadius: '9999px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    📍 {cov.kabupatenName}
                                    <button onClick={() => handleDeleteKabupaten(a.id, cov.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1, padding: 0 }}>×</button>
                                  </span>
                                ))}
                              </div>
                            )
                          }
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {areas.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Belum ada data area.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PETANI SECTION ─── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>Data Petani</h3>
          <button onClick={() => setShowFarmerForm(v => !v)} className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
            {showFarmerForm ? '✕ Tutup Form' : '➕ Tambah Petani'}
          </button>
        </div>
        {showFarmerForm && (
          <form onSubmit={handleAddFarmer} style={{ background: 'var(--surface-hover)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label><input name="name" type="text" className="form-control" required placeholder="Bpk. Budi" /></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">No. Telepon</label><input name="phone" type="text" className="form-control" placeholder="0812xxx" /></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Area / Kecamatan</label><input name="area" type="text" className="form-control" placeholder="Kec. Ngimbang" /></div>
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}><label className="form-label">Alamat Lengkap</label><input name="address" type="text" className="form-control" placeholder="Desa Purwodadi, RT 02..." /></div>
            {farmerError && <div style={{ color: 'var(--danger)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>{farmerError}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isPendingFarmer}>{isPendingFarmer ? 'Menyimpan...' : 'Simpan Petani'}</button>
              <button type="button" onClick={() => setShowFarmerForm(false)} className="btn btn-outline">Batal</button>
            </div>
          </form>
        )}
        {selectedFarmers.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedFarmers.size} petani dipilih</span>
            <button onClick={handleBulkDeleteFarmers} disabled={isPendingFarmer} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>🗑️ Hapus yang Dipilih</button>
            <button onClick={() => setSelectedFarmers(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
          </div>
        )}
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={chkTh}><input type="checkbox" checked={farmers.length > 0 && selectedFarmers.size === farmers.length} onChange={e => toggleAllFarmers(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} /></th>
                <th style={thStyle}>Nama Petani</th>
                <th style={thStyle}>No. Telepon</th>
                <th style={thStyle}>Area</th>
                <th style={thStyle}>Alamat</th>
                <th style={{ ...thStyle, width: '80px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map(f => (
                <tr key={f.id} style={{ background: selectedFarmers.has(f.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={chkTd}><input type="checkbox" checked={selectedFarmers.has(f.id)} onChange={() => toggleFarmer(f.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{f.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{f.phone || '-'}</td>
                  <td style={tdStyle}>{f.area || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{f.address || '-'}</td>
                  <td style={tdStyle}><button onClick={() => handleDeleteFarmer(f.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem' }} title="Hapus">🗑️</button></td>
                </tr>
              ))}
              {farmers.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Belum ada data petani.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>Total: {farmers.length} petani terdaftar</div>
      </div>
    </div>
  )
}
