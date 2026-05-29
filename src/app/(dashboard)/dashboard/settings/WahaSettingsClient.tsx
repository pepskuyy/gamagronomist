'use client'

import { useState, useEffect } from 'react'

interface ConfigEntry {
  key: string
  label: string
  group: string
  value: string
  defaultValue: string
  updatedAt: string | null
}

const PLACEHOLDERS: Record<string, { label: string; desc: string }[]> = {
  msg_afa_submit:  [
    { label: '{nama_afa}',    desc: 'Nama AFA yang mengajukan' },
    { label: '{catatan_afa}', desc: 'Catatan/keterangan yang diinput AFA saat pengajuan' },
  ],
  msg_spv_approve: [
    { label: '{nama_afa}',    desc: 'Nama AFA yang mengajukan' },
    { label: '{catatan_afa}', desc: 'Catatan/keterangan yang diinput AFA saat pengajuan' },
  ],
  msg_fam_approve: [
    { label: '{nama_afa}',    desc: 'Nama AFA yang mengajukan' },
    { label: '{catatan_afa}', desc: 'Catatan/keterangan yang diinput AFA saat pengajuan' },
  ],
  msg_whm_approve: [
    { label: '{nama_afa}',    desc: 'Nama AFA yang mengajukan' },
    { label: '{catatan_afa}', desc: 'Catatan/keterangan yang diinput AFA saat pengajuan' },
  ],
  msg_spv_receive: [
    { label: '{nama_afa}',    desc: 'Nama AFA' },
    { label: '{id_pengajuan}', desc: 'ID singkat pengajuan' },
    { label: '{invoice}',     desc: 'Info nomor invoice Accurate (otomatis, bisa kosong)' },
  ],
  msg_rejection: [
    { label: '{nama_afa}',      desc: 'Nama AFA' },
    { label: '{id_pengajuan}',   desc: 'ID singkat pengajuan' },
    { label: '{peran_penolak}', desc: 'Nama role yang menolak (SPV / FA Manager / WH Manager)' },
  ],
}

const MSG_EVENT_LABELS: Record<string, string> = {
  msg_afa_submit:  '1. AFA submit → ke SPV',
  msg_spv_approve: '2. SPV setujui → ke FA Manager',
  msg_fam_approve: '3. FA Manager setujui → ke WH Manager',
  msg_whm_approve: '4. WH Manager setujui → ke SPV (siap terima)',
  msg_spv_receive: '5. SPV konfirmasi terima → ke AFA (selesai)',
  msg_rejection:   '6. Ditolak → ke AFA',
}

export default function WahaSettingsClient() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'server' | 'phones' | 'templates'>('server')

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

  const resetTemplate = (key: string, defaultValue: string) => {
    setValues(v => ({ ...v, [key]: defaultValue }))
  }

  const insertPlaceholder = (key: string, ph: string) => {
    setValues(v => ({ ...v, [key]: (v[key] ?? '') + ph }))
  }

  const byGroup = (group: string) => configs.filter(c => c.group === group)

  if (loading) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      ⏳ Memuat konfigurasi...
    </div>
  )

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.6rem 1.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'none',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  })

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

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button style={tabStyle(activeTab === 'server')}    onClick={() => setActiveTab('server')}>🖥️ Server WAHA</button>
          <button style={tabStyle(activeTab === 'phones')}    onClick={() => setActiveTab('phones')}>📞 Nomor WA</button>
          <button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>✏️ Template Pesan</button>
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* ── Server ── */}
          {activeTab === 'server' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                WAHA (WhatsApp HTTP API) adalah self-hosted gateway untuk mengirim pesan WhatsApp.
              </p>
              {byGroup('server').map(c => (
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
                      c.key === 'waha_api_key'  ? 'Kosongkan jika tidak pakai auth' :
                      'default'
                    }
                    style={{ width: '100%', maxWidth: 480, padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
                  />
                </div>
              ))}

              {/* Test WA */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', fontWeight: 600 }}>🧪 Test Kirim WA</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input
                    type="text"
                    className="input"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    style={{ width: 220, padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
                  />
                  <button onClick={testWa} disabled={testing} className="btn btn-primary"
                    style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}>
                    {testing ? '⏳ Mengirim...' : '📤 Kirim Test WA'}
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Simpan konfigurasi terlebih dahulu agar test menggunakan pengaturan terbaru.</p>
              </div>
            </div>
          )}

          {/* ── Phones ── */}
          {activeTab === 'phones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Nomor WA yang akan menerima notifikasi ketika pengajuan stok tiba di tahap mereka.<br />
                <strong>Format:</strong> awali dengan 08 atau 62. Pisahkan dengan koma jika lebih dari satu.
              </p>
              {byGroup('phones').map(c => (
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
          )}

          {/* ── Templates ── */}
          {activeTab === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>ℹ️ Placeholder yang tersedia (klik untuk sisipkan):</strong> Data dari sistem yang bisa disisipkan ke dalam teks pesan secara otomatis.
                Biarkan kosong untuk menggunakan pesan bawaan.
              </div>

              {byGroup('templates').map(c => {
                const phs = PLACEHOLDERS[c.key] ?? []
                const eventLabel = MSG_EVENT_LABELS[c.key] ?? c.label
                return (
                  <div key={c.key} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                        {eventLabel}
                      </label>
                      <button
                        onClick={() => resetTemplate(c.key, c.defaultValue)}
                        style={{ fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '0.3rem' }}
                      >
                        ↩ Reset ke default
                      </button>
                    </div>

                    {/* Placeholder chips */}
                    {phs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        {phs.map(ph => (
                          <button
                            key={ph.label}
                            title={ph.desc}
                            onClick={() => insertPlaceholder(c.key, ph.label)}
                            style={{
                              padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
                              background: 'var(--primary-light, #eff6ff)', color: 'var(--primary)',
                              border: '1px solid var(--primary-100, #bfdbfe)', borderRadius: '9999px',
                              cursor: 'pointer', transition: 'background 0.15s',
                            }}
                          >
                            + {ph.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      className="input"
                      rows={5}
                      value={values[c.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [c.key]: e.target.value }))}
                      placeholder={c.defaultValue}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem', padding: '0.65rem 0.85rem', lineHeight: 1.65 }}
                    />
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Kosongkan untuk menggunakan pesan bawaan. Gunakan *teks* untuk bold. Gunakan \n untuk baris baru.
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={saveAll} disabled={saving} className="btn btn-primary"
          style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
          {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua Konfigurasi'}
        </button>
      </div>

      {/* Alur info */}
      <div className="card" style={{ padding: '1.25rem', background: 'var(--surface-2)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)' }}>ℹ️ Alur Notifikasi WhatsApp</strong>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 2, margin: 0 }}>
          <li><strong>AFA submit</strong> → WA ke nomor <strong>SPV</strong></li>
          <li><strong>SPV approve</strong> → WA ke nomor <strong>FA Manager</strong></li>
          <li><strong>FA Manager approve</strong> → WA ke nomor <strong>WH Manager</strong></li>
          <li><strong>WH Manager approve</strong> → WA ke nomor <strong>SPV</strong> (konfirmasi terima)</li>
          <li><strong>SPV konfirmasi terima</strong> → WA ke nomor WA pribadi AFA yang bersangkutan</li>
        </ol>
        <p style={{ margin: '0.75rem 0 0', fontStyle: 'italic' }}>
          Nomor WA AFA diambil dari profil masing-masing user (atur via Manajemen User → edit user → kolom No. WhatsApp).
        </p>
      </div>
    </div>
  )
}
