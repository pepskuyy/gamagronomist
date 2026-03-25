'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createArea, deleteArea, createFarmer, deleteFarmer, bulkDeleteAreas, bulkDeleteFarmers } from '@/app/actions/master'

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

  // Area form
  const [areaName, setAreaName] = useState('')
  const [areaError, setAreaError] = useState<string | null>(null)
  const [isPendingArea, startArea] = useTransition()

  // Farmer form
  const [showFarmerForm, setShowFarmerForm] = useState(false)
  const [farmerError, setFarmerError] = useState<string | null>(null)
  const [isPendingFarmer, startFarmer] = useTransition()

  // Bulk selection
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set())

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
    if (!confirm(`Hapus ${selectedAreas.size} area yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
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
    if (!confirm(`Hapus ${selectedFarmers.size} petani yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
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

  const BulkBar = ({ count, onDelete, pending }: { count: number; onDelete: () => void; pending: boolean }) =>
    count > 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{count} item dipilih</span>
        <button onClick={onDelete} disabled={pending} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
          🗑️ Hapus yang Dipilih
        </button>
        <button onClick={() => count > 0} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
          ✕ Batal Pilih
        </button>
      </div>
    ) : null

  return (
    <div>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
        <h2 style={{ margin: 0 }}>🗺️ Area &amp; Petani</h2>
      </div>

      {/* ─── AREA SECTION ─── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem' }}>Wilayah Area Operasional</h3>

        <form onSubmit={handleAddArea} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input name="name" type="text" className="form-control" placeholder="Nama area baru, misal: Jawa Timur" value={areaName} onChange={e => setAreaName(e.target.value)} style={{ flex: 1, minWidth: '200px' }} required />
          <button type="submit" className="btn btn-primary" disabled={isPendingArea}>{isPendingArea ? 'Menyimpan...' : '➕ Tambah Area'}</button>
        </form>
        {areaError && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{areaError}</div>}

        {selectedAreas.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedAreas.size} area dipilih</span>
            <button onClick={handleBulkDeleteAreas} disabled={isPendingArea} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
              🗑️ Hapus yang Dipilih
            </button>
            <button onClick={() => setSelectedAreas(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
          </div>
        )}

        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={chkTh}>
                  <input type="checkbox" checked={areas.length > 0 && selectedAreas.size === areas.length} onChange={e => toggleAllAreas(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
                <th style={thStyle}>Nama Area</th>
                <th style={thStyle}>Jumlah User</th>
                <th style={{ ...thStyle, width: '80px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {areas.map(a => (
                <tr key={a.id} style={{ background: selectedAreas.has(a.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={chkTd}>
                    <input type="checkbox" checked={selectedAreas.has(a.id)} onChange={() => toggleArea(a.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={tdStyle}><strong>{a.name}</strong></td>
                  <td style={tdStyle}>
                    <span className="badge badge-neutral">{a.users.length} user</span>
                    {a.users.slice(0, 3).map(u => (
                      <span key={u.id} style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.name} ({u.role})</span>
                    ))}
                    {a.users.length > 3 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{a.users.length - 3} lainnya</span>}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => handleDeleteArea(a.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }} title="Hapus">🗑️</button>
                  </td>
                </tr>
              ))}
              {areas.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Belum ada data area.</td></tr>
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
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="name" type="text" className="form-control" required placeholder="Bpk. Budi" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">No. Telepon</label>
              <input name="phone" type="text" className="form-control" placeholder="0812xxx" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Area / Kecamatan</label>
              <input name="area" type="text" className="form-control" placeholder="Kec. Ngimbang" />
            </div>
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Alamat Lengkap</label>
              <input name="address" type="text" className="form-control" placeholder="Desa Purwodadi, RT 02..." />
            </div>
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
            <button onClick={handleBulkDeleteFarmers} disabled={isPendingFarmer} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
              🗑️ Hapus yang Dipilih
            </button>
            <button onClick={() => setSelectedFarmers(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
          </div>
        )}

        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={chkTh}>
                  <input type="checkbox" checked={farmers.length > 0 && selectedFarmers.size === farmers.length} onChange={e => toggleAllFarmers(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
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
                  <td style={chkTd}>
                    <input type="checkbox" checked={selectedFarmers.has(f.id)} onChange={() => toggleFarmer(f.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{f.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{f.phone || '-'}</td>
                  <td style={tdStyle}>{f.area || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{f.address || '-'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => handleDeleteFarmer(f.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }} title="Hapus">🗑️</button>
                  </td>
                </tr>
              ))}
              {farmers.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Belum ada data petani.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Total: {farmers.length} petani terdaftar
        </div>
      </div>
    </div>
  )
}
