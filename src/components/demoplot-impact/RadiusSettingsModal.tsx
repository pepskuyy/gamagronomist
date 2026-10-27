'use client'

import { useState } from 'react'

export interface RadiusSettingsData {
  radius_km: number
  updated_at: string | null
  updated_by: string | null
  min_radius_km: number
  max_radius_km: number
  can_edit: boolean
}

interface Props {
  settings: RadiusSettingsData
  onClose: () => void
  onSaved: (settings: RadiusSettingsData) => void
}

export default function RadiusSettingsModal({ settings, onClose, onSaved }: Props) {
  const [value, setValue] = useState(String(settings.radius_km).replace('.', ','))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const n = Math.round(Number(value.trim().replace(',', '.')) * 100) / 100
    if (!Number.isFinite(n) || n < settings.min_radius_km || n > settings.max_radius_km) {
      setError('Radius harus antara 0,5 dan 20 km')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/demoplot-impact/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius_km: n }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan radius default.')
      onSaved(json)
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan radius default.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="radius-settings-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
        }}
      >
        <h3 id="radius-settings-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
          ⚙ Radius Coverage Default
        </h3>
        <p style={{ margin: '0.6rem 0 1rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
          Radius ini dipakai untuk lingkaran di peta, daftar toko sekitar, perhitungan dampak & % terdampak, tabel daftar
          demplot, serta export Excel. Pilihan radius di atas peta hanya mengubah tampilan sementara user tersebut.
        </p>

        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
          Radius default (km, 0,5–20)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.55rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.95rem',
            border: error ? '1px solid #dc2626' : '1px solid var(--border)',
          }}
        />
        {error && <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>{error}</div>}

        {settings.updated_at && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Terakhir diubah{' '}
            {new Date(settings.updated_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}
            {settings.updated_by ? ` oleh ${settings.updated_by}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Menyimpan…' : 'Simpan default'}
          </button>
        </div>
      </div>
    </div>
  )
}
