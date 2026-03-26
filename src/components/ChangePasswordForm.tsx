'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/app/actions/auth'

export default function ChangePasswordForm() {
  const [isPending, start] = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    setSuccess(false)
    start(async () => {
      const res = await changePassword(fd)
      if (res?.error) setError(res.error)
      else {
        setSuccess(true);
        (e.currentTarget as HTMLFormElement)?.reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
      <div className="form-group">
        <label className="form-label">Password Lama <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input name="currentPassword" type="password" className="form-control" required autoComplete="current-password" />
      </div>
      <div className="form-group">
        <label className="form-label">Password Baru <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input name="newPassword" type="password" className="form-control" required autoComplete="new-password" minLength={6} />
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Minimal 6 karakter.</p>
      </div>
      <div className="form-group">
        <label className="form-label">Konfirmasi Password Baru <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input name="confirmPassword" type="password" className="form-control" required autoComplete="new-password" />
      </div>

      {error   && <div style={{ color: 'var(--danger)',  background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ color: '#166534',        background: '#dcfce7', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.875rem' }}>✅ Password berhasil diubah! Gunakan password baru saat login berikutnya.</div>}

      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ minWidth: '180px' }}>
        {isPending ? 'Menyimpan...' : '🔐 Ubah Password'}
      </button>
    </form>
  )
}
