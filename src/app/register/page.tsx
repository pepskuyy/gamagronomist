'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { submitAccountRequest } from '../actions/register'

export default function RegisterPage() {
  const [isPending, start] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [role,    setRole]    = useState('')
  const [areas,   setAreas]   = useState<{ id: string; name: string }[]>([])



  useEffect(() => {
    fetch('/api/master/areas')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAreas(data)
      })
      .catch(console.error)
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const res = await submitAccountRequest(fd)
      if (res?.error) setError(res.error)
      else setSuccess(true)
    })
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="login-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, background: 'var(--primary)', borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(255,255,255,0.2)"/><path d="M12 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-2.7 0-5.8 1.29-6 2h12c-.2-.71-3.3-2-6-2z" fill="white"/></svg>
            </div>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>Agrolens</span>
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>Buat Akun Baru</h2>
          <p style={{ fontSize: '0.85rem' }}>Permintaan akan dikonfirmasi oleh SPV sebelum aktif</p>
        </div>

        {/* Success state */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Permintaan Terkirim!</h3>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Permintaan akun Anda telah dikirim ke SPV. Anda akan dapat masuk setelah disetujui.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="name" type="text" className="form-control" required placeholder="contoh: Budi Santoso" />
            </div>

            {/* Email */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="email" type="email" className="form-control" required placeholder="contoh: budi@gmail.com" />
            </div>

            {/* Username */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Username <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="username" type="text" className="form-control" required placeholder="contoh: budi.s" style={{ textTransform: 'lowercase' }} />
            </div>

            {/* Password row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input name="password" type="password" className="form-control" required placeholder="Min. 6 karakter" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Konfirmasi <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input name="confirm" type="password" className="form-control" required placeholder="Ulangi password" />
              </div>
            </div>

            {/* Role */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Role / Jabatan <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select name="role" className="form-control" required value={role} onChange={e => setRole(e.target.value)}>
                <option value="">-- Pilih Role --</option>
                <option value="AFA">AFA (Asisten Field Agronomi)</option>
                <option value="FO">FO (Field Officer)</option>
                <option value="INTERN">INTERN (Magang)</option>
              </select>
            </div>

            {/* Area */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Area / Wilayah <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select name="areaName" className="form-control" required>
                <option value="">-- Pilih Area --</option>
                {areas.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* AFA name (only for FO) */}
            {(role === 'FO' || role === 'INTERN') && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Supervisor AFA <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input name="afaName" type="text" className="form-control" required={role === 'FO' || role === 'INTERN'} placeholder="Nama AFA yang jadi supervisor Anda" />
              </div>
            )}

            {/* Notes */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Catatan untuk SPV</label>
              <textarea name="notes" className="form-control" rows={2} placeholder="Informasi tambahan untuk SPV (opsional)" style={{ resize: 'none' }} />
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.7rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={isPending} style={{ marginTop: '0.25rem', padding: '0.8rem', fontSize: '0.95rem', width: '100%' }}>
              {isPending ? 'Mengirim Permintaan...' : 'Kirim Permintaan Akun'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sudah punya akun?{' '}
              <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Masuk di sini</Link>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a9b55 0%, #158044 100%);
          padding: 1.5rem;
        }
        .login-card {
          background: var(--surface);
          border-radius: var(--radius-xl);
          box-shadow: 0 24px 48px rgba(0,0,0,0.18);
          padding: 2.25rem;
          width: 100%;
          animation: slideUp 0.4s ease-out;
        }
        .login-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .btn-block { width: 100%; display: flex; justify-content: center; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
