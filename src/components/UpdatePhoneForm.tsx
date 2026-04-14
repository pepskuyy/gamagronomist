'use client'

import { useState, useTransition } from 'react'
import { updatePhone } from '@/app/actions/auth'

export default function UpdatePhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [phone, setPhone]     = useState(currentPhone || '')
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, start]    = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await updatePhone(fd)
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
          ✅ Nomor WhatsApp berhasil disimpan! Notifikasi akan dikirim ke nomor ini.
        </div>
      )}

      <div>
        <label className="form-label">Nomor WhatsApp</label>
        <input
          name="phone"
          type="tel"
          className="form-control"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Contoh: 628123456789 atau 08123456789"
        />
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          📱 Format: <strong>628xxx</strong> (internasional tanpa +) atau <strong>08xxx</strong>. Nomor ini digunakan untuk menerima notifikasi WhatsApp via Waha.
        </p>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isPending}
        style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem' }}
      >
        {isPending ? 'Menyimpan...' : '💾 Simpan Nomor WA'}
      </button>
    </form>
  )
}
