'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { cldThumb } from '@/lib/cloudinary-url'
import { createUser, updateUser, deleteUser, bulkDeleteUsers } from '@/app/actions/master'
import ImageUploader from '@/components/ImageUploader'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

type User = { id: string; name: string; username: string; role: string; isActive: boolean; photo: string | null; area: { id: string; name: string } | null; afa: { id: string; name: string } | null }
type Area = { id: string; name: string }

const ROLES = ['ADMIN', 'SPV', 'AFA', 'PLANTATION', 'FO', 'INTERN', 'FAM', 'WHM', 'BD']
const roleBadge: Record<string, string> = { ADMIN: 'badge-danger', SPV: 'badge-warning', AFA: 'badge-success', FO: 'badge-neutral', INTERN: 'badge-neutral', FAM: 'badge-neutral', WHM: 'badge-neutral', BD: 'badge-neutral' }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
}
const modalStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%', maxWidth: '520px',
  boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto'
}

export default function UsersMasterPage() {
  const [users,  setUsers]  = useState<User[]>([])
  const [areas,  setAreas]  = useState<Area[]>([])
  const [afas,   setAfas]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,  setModal]  = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [formPhoto, setFormPhoto] = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  // Bulk selection
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  const fetchData = async () => {
    const [uRes, aRes] = await Promise.all([
      fetch('/api/master/users'),
      fetch('/api/master/areas'),
    ])
    const users = uRes.ok ? await uRes.json() : []
    if (uRes.ok) { setUsers(users); setAfas(users.filter((u: User) => ['AFA', 'PLANTATION'].includes(u.role))) }
    if (aRes.ok) setAreas(await aRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() { setSelected(null); setFormPhoto(null); setError(null); setModal('add') }
  function openEdit(u: User) { setSelected(u); setFormPhoto(u.photo || null); setError(null); setModal('edit') }
  function closeModal() { setModal(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const res = modal === 'add'
        ? await createUser(fd)
        : await updateUser(selected!.id, fd)
      if (res?.error) { setError(res.error) }
      else { closeModal(); fetchData() }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus user "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    start(async () => {
      const res = await deleteUser(id)
      if (res?.error) alert(res.error)
      else fetchData()
    })
  }

  function handleBulkDelete() {
    if (!selectedUsers.size) return
    if (!confirm(`Hapus ${selectedUsers.size} user yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
    start(async () => {
      const res = await bulkDeleteUsers(Array.from(selectedUsers))
      if (res?.error) alert(res.error)
      else { setSelectedUsers(new Set()); fetchData() }
    })
  }

  function toggleUser(id: string) {
    setSelectedUsers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllUsers(checked: boolean) {
    setSelectedUsers(checked ? new Set(users.map(u => u.id)) : new Set())
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }

  return (
    <div>
      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={modalStyle}>
            <h3 style={{ marginBottom: '1.5rem' }}>{modal === 'add' ? 'Tambah User Baru' : 'Edit User'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modal === 'add' && (
                <div>
                  <label style={labelStyle}>Username <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input name="username" style={inputStyle} required placeholder="contoh: afa2" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input name="name" style={inputStyle} required defaultValue={selected?.name} placeholder="contoh: Budi Santoso" />
              </div>
              <div>
                <label style={labelStyle}>Foto Profil</label>
                <input type="hidden" name="photo" value={formPhoto || ''} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-hover)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                    {formPhoto ? (
                      <img src={formPhoto} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Kosong</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <ImageUploader onUploadSuccess={(urls) => setFormPhoto(urls[0] || null)} maxFiles={1} label="Upload" />
                  </div>
                  {formPhoto && (
                    <button type="button" onClick={() => setFormPhoto(null)} className="btn btn-outline" style={{ color: 'var(--danger)', padding: '0.375rem 0.75rem' }}>Hapus</button>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{modal === 'add' ? 'Password' : 'Password Baru'} {modal === 'add' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <input name="password" type="password" style={inputStyle} required={modal === 'add'} placeholder={modal === 'edit' ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'} />
              </div>
              <div>
                <label style={labelStyle}>Role <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select name="role" style={inputStyle} required defaultValue={selected?.role || ''}>
                  <option value="">-- Pilih Role --</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Area</label>
                <select name="areaId" style={inputStyle} defaultValue={selected?.area?.id || ''}>
                  <option value="">-- Tanpa Area --</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Supervisor AFA <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(khusus role FO/INTERN)</span></label>
                <select name="afaId" style={inputStyle} defaultValue={selected?.afa?.id || ''}>
                  <option value="">-- Tanpa Supervisor --</option>
                  {afas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {modal === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Status Aktif</label>
                  <select name="isActive" style={{ ...inputStyle, width: 'auto' }} defaultValue={selected?.isActive ? 'true' : 'false'}>
                    <option value="true">Aktif</option>
                    <option value="false">Tidak Aktif</option>
                  </select>
                </div>
              )}
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
          <h2 style={{ margin: 0 }}>Master Data: Pengguna</h2>
        </div>
        <button onClick={openAdd} className="btn btn-primary"><Plus size={16} strokeWidth={1.75} className="icon-inline" /> Tambah User</button>
      </div>

      {/* Bulk delete bar */}
      {selectedUsers.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}><span className="num">{selectedUsers.size}</span> user dipilih</span>
          <button onClick={handleBulkDelete} disabled={isPending} className="btn btn-danger" style={{ padding: '0.375rem 0.875rem', fontSize: '0.82rem' }}><Trash2 size={16} strokeWidth={1.75} className="icon-inline" /> Hapus yang Dipilih</button>
          <button onClick={() => setSelectedUsers(new Set())} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.82rem' }}><X size={16} strokeWidth={1.75} className="icon-inline" /> Batal</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={users.length > 0 && selectedUsers.size === users.length} onChange={e => toggleAllUsers(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
                {['Nama', 'Username', 'Role', 'Status', 'Area', 'Supervisor AFA', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)', background: selectedUsers.has(u.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={{ padding: '0.75rem 1rem', width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleUser(u.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0, overflow: 'hidden' }}>
                        {u.photo ? <img src={cldThumb(u.photo, 64)} alt={u.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono-stack)', fontSize: '0.82rem' }}>{u.username}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${roleBadge[u.role] ?? 'badge-neutral'}`}>{u.role}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500, background: u.isActive ? 'var(--success-bg)' : 'var(--danger-bg)', color: u.isActive ? 'var(--success)' : 'var(--danger)' }}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{u.area?.name || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{u.afa?.name || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(u)} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}><Pencil size={14} strokeWidth={1.75} className="icon-inline" /> Edit</button>
                      <button onClick={() => handleDelete(u.id, u.name)} title="Hapus" style={{ padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} strokeWidth={1.75} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data pengguna.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
          Total: <span className="num">{users.length}</span> user
        </div>
      </div>
    </div>
  )
}
