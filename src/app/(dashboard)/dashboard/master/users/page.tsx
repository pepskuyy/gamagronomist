'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createUser, updateUser, deleteUser } from '@/app/actions/master'

type User = { id: string; name: string; username: string; role: string; area: { id: string; name: string } | null; afa: { id: string; name: string } | null }
type Area = { id: string; name: string }

const ROLES = ['ADMIN', 'SPV', 'AFA', 'FO']
const roleBadge: Record<string, string> = { ADMIN: 'badge-danger', SPV: 'badge-warning', AFA: 'badge-success', FO: 'badge-neutral' }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '520px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
}

export default function UsersMasterPage() {
  const [users,  setUsers]  = useState<User[]>([])
  const [areas,  setAreas]  = useState<Area[]>([])
  const [afas,   setAfas]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,  setModal]  = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  const fetchData = async () => {
    const [uRes, aRes] = await Promise.all([
      fetch('/api/master/users'),
      fetch('/api/master/areas'),
    ])
    const users = uRes.ok ? await uRes.json() : []
    if (uRes.ok) { setUsers(users); setAfas(users.filter((u: User) => u.role === 'AFA')) }
    if (aRes.ok) setAreas(await aRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() { setSelected(null); setError(null); setModal('add') }
  function openEdit(u: User) { setSelected(u); setError(null); setModal('edit') }
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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9rem', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.35rem' }

  return (
    <div>
      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={modalStyle}>
            <h3 style={{ marginBottom: '1.5rem' }}>{modal === 'add' ? '➕ Tambah User Baru' : '✏️ Edit User'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modal === 'add' && (
                <div>
                  <label style={labelStyle}>Username <span style={{ color: 'red' }}>*</span></label>
                  <input name="username" style={inputStyle} required placeholder="contoh: afa2" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Nama Lengkap <span style={{ color: 'red' }}>*</span></label>
                <input name="name" style={inputStyle} required defaultValue={selected?.name} placeholder="contoh: Budi Santoso" />
              </div>
              <div>
                <label style={labelStyle}>{modal === 'add' ? 'Password' : 'Password Baru'} {modal === 'add' && <span style={{ color: 'red' }}>*</span>}</label>
                <input name="password" type="password" style={inputStyle} required={modal === 'add'} placeholder={modal === 'edit' ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'} />
              </div>
              <div>
                <label style={labelStyle}>Role <span style={{ color: 'red' }}>*</span></label>
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
                <label style={labelStyle}>Supervisor AFA <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(khusus role FO)</span></label>
                <select name="afaId" style={inputStyle} defaultValue={selected?.afa?.id || ''}>
                  <option value="">-- Tanpa Supervisor --</option>
                  {afas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {error && <div style={{ color: '#dc2626', fontSize: '0.875rem', background: '#fee2e2', padding: '0.6rem 0.9rem', borderRadius: '0.5rem' }}>{error}</div>}
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
          <h2 style={{ margin: 0 }}>👥 Master Data: Pengguna</h2>
        </div>
        <button onClick={openAdd} className="btn btn-primary">➕ Tambah User</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)', borderBottom: '2px solid var(--border)' }}>
              <tr>
                {['Nama', 'Username', 'Role', 'Area', 'Supervisor AFA', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.username}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className={`badge ${roleBadge[u.role] ?? 'badge-neutral'}`}>{u.role}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>{u.area?.name || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{u.afa?.name || '-'}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(u)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(u.id, u.name)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'none', border: '1px solid var(--border)', borderRadius: '0.4rem', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data pengguna.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
          Total: {users.length} user
        </div>
      </div>
    </div>
  )
}
