'use client'

import { useState, useEffect } from 'react'

interface ConfigEntry {
  key: string
  label: string
  value: string
  updatedAt: string | null
}

export default function WahaSettingsClient() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetch('/api/system-config')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setConfigs(data.data)
          const map: Record<string, string> = {}
          data.data.forEach((c: ConfigEntry) => { map[c.key] = c.value })
          setValues(map)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const saveAll = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const body = configs.map(c => ({ key: c.key, value: values[c.key] ?? '' }))
      const res = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: `✅ ${data.updated} konfigurasi berhasil disimpan.` })
      } else {
        setMsg({ type: 'error', text: data.error ?? 'Gagal menyimpan.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Gagal menghubungi server.' })
    } finally {
      setSaving(false)
    }
  }

  const testWa = async () => {
    if (!testPhone) { setMsg({ type: 'error', text: 'Masukkan nomor WA untuk test.' }); return }
    setTesting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/system-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: '✅ Pesan WA test berhasil dikirim! Cek WhatsApp Anda.' })
      } else {
        setMsg({ type: 'error', text: `❌ Gagal kirim WA: ${data.error}` })
      }
    } catch {
      setMsg({ type: 'error', text: 'Gagal menghubungi server.' })
    } finally {
      setTesting(false)
    }
  }

  const wahaKeys = ['waha_base_url', 'waha_api_key', 'waha_session']
  const phoneKeys = ['wa_spv', 'wa_fam', 'wa_whm']

  if (loading) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      ⏳ Memuat konfigurasi...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📱 Integrasi WhatsApp (WAHA)
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Konfigurasi notifikasi WhatsApp otomatis untuk alur approval pengajuan stok AFA.
        </p>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: '0.85rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500,
          background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fecaca'}`,
          color: msg.type === 'success' ? '#16a34a' : '#dc2626',
        }}>
          {msg.text}
        </div>
      )}

      {/* WAHA Server Config */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>🖥️ Konfigurasi WAHA Server</h3>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          WAHA (WhatsApp HTTP API) adalah self-hosted gateway untuk mengirim pesan WhatsApp.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configs.filter(c => wahaKeys.includes(c.key)).map(c => (
            <div key={c.key}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {c.label}
              </label>
              <input
                type={c.key === 'waha_api_key' ? 'password' : 'text'}
                className="input"
                value={values[c.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [c.key]: e.target.value }))}
                placeholder={
                  c.key === 'waha_base_url' ? 'http://localhost:3000' :
                  c.key === 'waha_api_key' ? 'API key (kosongkan jika tidak pakai)' :
                  'default'
                }
                style={{ width: '100%', maxWidth: 480, padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Phone Numbers per Role */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>📞 Nomor WhatsApp per Role</h3>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Nomor WA yang akan menerima notifikasi ketika pengajuan stok tiba di tahap mereka.<br />
          <strong>Format:</strong> awali dengan 08 atau 62. Pisahkan dengan koma jika lebih dari satu nomor.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configs.filter(c => phoneKeys.includes(c.key)).map(c => (
            <div key={c.key}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {c.label}
              </label>
              <input
                type="text"
                className="input"
                value={values[c.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [c.key]: e.target.value }))}
                placeholder="08xxxxxxxxxx, 08xxxxxxxxxx"
                style={{ width: '100%', maxWidth: 480, padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* WA Test */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>🧪 Test Kirim WhatsApp</h3>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Kirim pesan test ke nomor tertentu untuk memverifikasi koneksi WAHA. Pastikan konfigurasi sudah disimpan terlebih dahulu.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nomor Tujuan
            </label>
            <input
              type="text"
              className="input"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              style={{ width: 220, padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
            />
          </div>
          <button
            onClick={testWa}
            disabled={testing}
            className="btn btn-primary"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}
          >
            {testing ? '⏳ Mengirim...' : '📤 Kirim Test WA'}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={saveAll}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem', fontWeight: 700 }}
        >
          {saving ? '⏳ Menyimpan...' : '💾 Simpan Konfigurasi'}
        </button>
        {msg && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Perubahan akan aktif setelah disimpan.</span>}
      </div>

      {/* Info alur */}
      <div className="card" style={{ padding: '1.25rem', background: 'var(--surface-2)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)' }}>ℹ️ Alur Notifikasi WhatsApp</strong>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 2, margin: 0 }}>
          <li><strong>AFA submit</strong> → WA dikirim ke nomor <strong>SPV</strong></li>
          <li><strong>SPV approve</strong> → WA dikirim ke nomor <strong>FA Manager</strong></li>
          <li><strong>FA Manager approve</strong> → WA dikirim ke nomor <strong>WH Manager</strong></li>
          <li><strong>WH Manager approve</strong> → WA dikirim ke nomor <strong>SPV</strong> (konfirmasi terima)</li>
          <li><strong>SPV konfirmasi terima</strong> → WA dikirim ke nomor WA AFA yang bersangkutan</li>
        </ol>
        <p style={{ margin: '0.75rem 0 0', fontStyle: 'italic' }}>
          Nomor WA AFA diambil dari profil masing-masing user (dapat diatur melalui menu Manajemen User).
        </p>
      </div>
    </div>
  )
}
