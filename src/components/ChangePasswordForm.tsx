'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Lock } from 'lucide-react'
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
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Minimal 6 karakter.</p>
      </div>
      <div className="form-group">
        <label className="form-label">Konfirmasi Password Baru <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input name="confirmPassword" type="password" className="form-control" required autoComplete="new-password" />
      </div>

      {error   && <div style={{ color: 'var(--danger)',  background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} strokeWidth={1.75} className="icon-inline" />Password berhasil diubah! Gunakan password baru saat login berikutnya.</div>}

      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ minWidth: '180px' }}>
        {isPending ? 'Menyimpan...' : <><Lock size={16} strokeWidth={1.75} className="icon-inline" />Ubah Password</>}
      </button>
    </form>
  )
}
