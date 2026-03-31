'use client'

import { useState, useTransition } from 'react'
import { updateEmail } from '@/app/actions/auth'

export default function UpdateEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState(currentEmail || '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await updateEmail(fd)
      if (res?.error) setError(res.error)
      else setSuccess(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
          ✅ Email berhasil diperbarui!
        </div>
      )}

      <div>
        <label className="form-label">Email</label>
        <input 
          name="email" 
          type="email"
          className="form-control" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="contoh@email.com"
          required
        />
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          Email ini akan digunakan untuk verifikasi saat lupa password.
        </p>
      </div>

      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem' }}>
        {isPending ? 'Menyimpan...' : '💾 Simpan Email'}
      </button>
    </form>
  )
}
