'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createStore, updateStore, deleteStore, bulkDeleteStores } from '@/app/actions/master'
import { Plus, Pencil, Trash2, RefreshCw, Upload, CheckCircle2, XCircle, AlertTriangle, X, MapPin, Link2 } from 'lucide-react'

type Store = {
  id: string
  accurateId: string | null
  name: string
  code: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  notes: string | null
  defaultSalesman: string | null
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
}
const modalStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%', maxWidth: '500px',
  boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto'
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }

export default function StoresMasterPage() {
  const [stores, setStores]     = useState<Store[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Store | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()
  const [search, setSearch]     = useState('')
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set())
  const [syncing, setSyncing]     = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ page: number; totalPages: number; pct: number } | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string; detail?: string } | null>(null)

  const thStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)' }

  const fetchData = async () => {
    const res = await fetch('/api/master/stores')
    if (res.ok) setStores(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd()            { setSelected(null); setError(null); setModal('add') }
  function openEdit(s: Store)   { setSelected(s); setError(null); setModal('edit') }
  function closeModal()         { setModal(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const res = modal === 'add'
        ? await createStore(fd)
        : await updateStore(selected!.id, fd)
      if (res?.error) setError(res.error)
      else { closeModal(); fetchData() }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus toko "${name}"?`)) return
    start(async () => {
      const res = await deleteStore(id)
      if (res?.error) alert(res.error)
      else fetchData()
    })
  }

  function handleBulkDelete() {
    if (!selectedStores.size) return
    if (!confirm(`Hapus ${selectedStores.size} toko yang dipilih?`)) return
    start(async () => {
      const res = await bulkDeleteStores(Array.from(selectedStores))
      if (res?.error) alert(res.error)
      else { setSelectedStores(new Set()); fetchData() }
    })
  }

  async function handleExportExcel() {
    if (stores.length === 0) { alert('Belum ada data toko.'); return }
    const XLSX = await import('xlsx') // lazy-load
    const data = [
      ['ID DB', 'Kode Accurate', 'Nama Toko', 'Alamat', 'Latitude', 'Longitude', 'Telepon', 'Catatan'],
      ...filteredStores.map(s => [s.id, s.code || '', s.name, s.address || '', s.latitude ?? '', s.longitude ?? '', s.phone || '', s.notes || ''])
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 35 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Toko')
    XLSX.writeFile(wb, `master_toko_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleAccurateSync() {
    if (!confirm('Sinkronisasi toko/pelanggan dari Accurate Online?\n\n• Toko baru akan ditambahkan\n• Nama, kode, koordinat GPS, dan salesman akan diperbarui\n• Proses berjalan per halaman (±30 halaman) — jangan tutup tab ini')) return
    setSyncing(true)
    setSyncResult(null)
    setSyncProgress(null)

    let page = 1
    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0
    let totalRows = 0

    try {
      while (true) {
        const res = await fetch(`/api/accurate-sync-customers?page=${page}`, { method: 'POST' })
        const data = await res.json()

        if (data.error) {
          setSyncResult({ ok: false, msg: data.error })
          break
        }

        totalInserted += data.inserted ?? 0
        totalUpdated  += data.updated  ?? 0
        totalSkipped  += data.skipped  ?? 0
        totalRows      = data.total    ?? totalRows

        const pct = data.totalPages ? Math.round((page / data.totalPages) * 100) : 0
        setSyncProgress({ page, totalPages: data.totalPages ?? page, pct })

        if (data.done) {
          fetchData()
          setSyncResult({
            ok: true,
            msg: `Sinkronisasi selesai: ${totalInserted} toko baru, ${totalUpdated} diperbarui, ${totalSkipped} dilewati.`,
            detail: `Total dari Accurate: ${totalRows} customer — ${data.totalPages} halaman diproses.`,
          })
          break
        }

        page++
        // Jeda kecil agar tidak flood API Accurate
        await new Promise(r => setTimeout(r, 300))
      }
    } catch {
      setSyncResult({ ok: false, msg: 'Gagal menghubungi server. Cek koneksi.' })
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }

  function toggleStore(id: string) {
    setSelectedStores(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll(checked: boolean) {
    setSelectedStores(checked ? new Set(filteredStores.map(s => s.id)) : new Set())
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  )

  const withCoords = stores.filter(s => s.latitude && s.longitude).length

  return (
    <div>
      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={modalStyle}>
            <h3 style={{ marginBottom: '1.5rem' }}>{modal === 'add' ? 'Tambah Toko' : 'Edit Toko'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nama Toko <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input name="name" style={inputStyle} required defaultValue={selected?.name} placeholder="Nama toko/kios" />
                </div>
                <div>
                  <label style={labelStyle}>Kode (dari Accurate)</label>
                  <input name="code" style={inputStyle} defaultValue={selected?.code || ''} placeholder="mis: CUST-001" />
                </div>
                <div>
                  <label style={labelStyle}>Telepon</label>
                  <input name="phone" style={inputStyle} defaultValue={selected?.phone || ''} placeholder="08xx-xxxx-xxxx" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Alamat</label>
                  <textarea name="address" style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} defaultValue={selected?.address || ''} placeholder="Alamat lengkap toko" />
                </div>
                <div>
                  <label style={labelStyle}>Latitude</label>
                  <input name="latitude" type="number" step="0.000001" style={inputStyle} defaultValue={selected?.latitude ?? ''} placeholder="-7.12345" />
                </div>
                <div>
                  <label style={labelStyle}>Longitude</label>
                  <input name="longitude" type="number" step="0.000001" style={inputStyle} defaultValue={selected?.longitude ?? ''} placeholder="110.12345" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Catatan</label>
                  <textarea name="notes" style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} defaultValue={selected?.notes || ''} placeholder="Keterangan tambahan..." />
                </div>
              </div>
              {error && <div style={{ color: 'var(--danger)', fontSize: '0.875rem', background: 'var(--danger-bg)', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isPending} style={{ flex: 1 }}>
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={closeModal} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
          <div>
            <h2 style={{ margin: 0 }}>Master Data: Toko / Kios</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span className="num">{stores.length}</span> toko (<span className="num">{withCoords}</span> dengan koordinat GPS → tampil di peta)
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Cari nama / kode / alamat..."
            className="form-control"
            style={{ minWidth: '250px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={handleAccurateSync}
            disabled={syncing}
            className="btn btn-outline"
            style={{ background: syncing ? 'var(--surface-2)' : undefined }}
            title="Sinkronisasi nama, kode, koordinat GPS, dan salesman dari Accurate Online"
          >
            {syncing
              ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--text-muted)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {syncProgress ? `Hal. ${syncProgress.page}/${syncProgress.totalPages} (${syncProgress.pct}%)` : 'Memulai sync...'}</>
              : <><RefreshCw size={16} strokeWidth={1.75} className="icon-inline" /> Sync Accurate</>
            }
          </button>
          <button onClick={handleExportExcel} className="btn btn-outline"><Upload size={16} strokeWidth={1.75} className="icon-inline" /> Export Excel</button>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={16} strokeWidth={1.75} className="icon-inline" /> Tambah Toko</button>
        </div>
      </div>

      {/* Progress Bar saat sync berjalan */}
      {syncing && syncProgress && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            <span><RefreshCw size={14} strokeWidth={1.75} className="icon-inline" /> Menyinkronkan data dari Accurate...</span>
            <span className="num" style={{ color: 'var(--text-muted)' }}>Halaman {syncProgress.page} / {syncProgress.totalPages} ({syncProgress.pct}%)</span>
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '9999px', background: 'var(--primary)', width: `${syncProgress.pct}%`, transition: 'width 0.3s var(--ease)' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: '0.5rem 0 0' }}>Jangan tutup tab ini hingga sinkronisasi selesai.</p>
        </div>
      )}

      {/* Sync Result Banner */}
      {syncResult && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
          padding: '0.75rem 1rem',
          background: syncResult.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem',
        }}>
          <div>
            <div style={{ fontWeight: 500, color: syncResult.ok ? 'var(--success)' : 'var(--danger)' }}>
              {syncResult.ok ? <CheckCircle2 size={16} strokeWidth={1.75} className="icon-inline" /> : <XCircle size={16} strokeWidth={1.75} className="icon-inline" />} {syncResult.msg}
            </div>
            {syncResult.detail && <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.8rem' }}>{syncResult.detail}</div>}
            {syncResult.ok && (
              <div style={{ color: 'var(--warning)', marginTop: '0.25rem', fontSize: '0.78rem' }}>
                <AlertTriangle size={14} strokeWidth={1.75} className="icon-inline" /> Koordinat hanya terisi jika ada data di field <strong>charfield4 (lat)</strong> dan <strong>charfield3 (lng)</strong> di Accurate.
              </div>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}><X size={16} strokeWidth={1.75} className="icon-inline" /></button>
        </div>
      )}

      {/* Bulk delete bar */}
      {selectedStores.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}><span className="num">{selectedStores.size}</span> toko dipilih</span>
          <button onClick={handleBulkDelete} disabled={isPending} className="btn btn-danger" style={{ padding: '0.375rem 0.875rem', fontSize: '0.82rem' }}><Trash2 size={16} strokeWidth={1.75} className="icon-inline" /> Hapus yang Dipilih</button>
          <button onClick={() => setSelectedStores(new Set())} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.82rem' }}><X size={16} strokeWidth={1.75} className="icon-inline" /> Batal</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={filteredStores.length > 0 && selectedStores.size === filteredStores.length} onChange={e => toggleAll(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
                <th style={{ ...thStyle, width: '14%' }}>Kode</th>
                <th style={{ ...thStyle, width: '25%' }}>Nama Toko</th>
                <th style={{ ...thStyle, width: '20%' }}>Alamat</th>
                <th style={{ ...thStyle, width: '12%' }}>GPS</th>
                <th style={{ ...thStyle, width: '12%' }}>Salesman</th>
                <th style={{ ...thStyle, width: '10%' }}>Telepon</th>
                <th style={{ ...thStyle, width: '10%', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map(s => (
                <tr key={s.id} style={{ background: selectedStores.has(s.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={{ ...tdStyle, width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedStores.has(s.id)} onChange={() => toggleStore(s.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono-stack)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {s.code || '—'}
                    {s.accurateId && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><Link2 size={12} strokeWidth={1.75} className="icon-inline" /> Accurate</div>}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-main)' }}>{s.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.address || '—'}</td>
                  <td style={{ ...tdStyle }}>
                    {s.latitude && s.longitude ? (
                      <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-xs)', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: 'var(--success)', fontFamily: 'var(--font-mono-stack)' }}>
                        <MapPin size={12} strokeWidth={1.75} /> {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}><AlertTriangle size={14} strokeWidth={1.75} className="icon-inline" /> Belum ada</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem' }}>
                    {s.defaultSalesman ? (
                      <span style={{ padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: s.defaultSalesman.toLowerCase().includes('busdev') ? 'var(--info-bg)' : 'var(--surface-2)', color: s.defaultSalesman.toLowerCase().includes('busdev') ? 'var(--info)' : 'var(--text-secondary)' }}>
                        {s.defaultSalesman}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.phone || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(s)} className="btn btn-outline" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', marginRight: '0.5rem' }}><Pencil size={14} strokeWidth={1.75} className="icon-inline" /> Edit</button>
                    <button onClick={() => handleDelete(s.id, s.name)} title="Hapus" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--danger-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}><Trash2 size={14} strokeWidth={1.75} /></button>
                  </td>
                </tr>
              ))}
              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada data toko atau tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
