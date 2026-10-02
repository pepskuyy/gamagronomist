'use client'

import { useState, useTransition } from 'react'
import { generateApiKeyAction, toggleApiKeyAction, deleteApiKeyAction } from '@/app/actions/api-keys'

type ApiKeyItem = {
  id: string
  name: string
  keyPrefix: string
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
}

type Props = {
  initialKeys: ApiKeyItem[]
}

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/demoplot',
    desc: 'Daftar demo plot + koordinat GPS (latitude, longitude) & produk',
    params: 'from, to, sales, area, status, has_coords, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/spot-demplot',
    desc: 'Spot demplot & pengamatan gulma/lahan',
    params: 'from, to, sales, desa, kecamatan, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/farmer-gathering',
    desc: 'Temu kelompok tani / farmer meeting',
    params: 'from, to, sales, district, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/customer-behavior',
    desc: 'Riset perilaku petani & preferensi produk',
    params: 'from, to, sales, commodity, district, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/visit-kios',
    desc: 'Kunjungan kios / toko pertanian',
    params: 'from, to, sales, kios, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/visit-company',
    desc: 'Kunjungan perusahaan / perkebunan',
    params: 'from, to, sales, company, limit, page',
  },
  {
    method: 'GET',
    path: '/api/v1/content-video',
    desc: 'Aktivitas pembuatan konten video',
    params: 'from, to, sales, theme, limit, page',
  },
]

export default function OpenApiClient({ initialKeys }: Props) {
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys')
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys)
  const [appName, setAppName] = useState('')
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ─── Generate Key ───────────────────────────────────────────────────────────
  function handleGenerate() {
    if (!appName.trim()) {
      setError('Nama aplikasi konsumen wajib diisi.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await generateApiKeyAction(appName.trim())
      if (!res.success || !res.rawKey) {
        setError(res.error ?? 'Gagal membuat API key.')
        return
      }
      setNewRawKey(res.rawKey)
      setAppName('')
      if (res.item) {
        setKeys(prev => [res.item as ApiKeyItem, ...prev])
      }
    })
  }

  // ─── Copy to Clipboard ─────────────────────────────────────────────────────
  async function handleCopy() {
    if (!newRawKey) return
    await navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ─── Toggle Status ─────────────────────────────────────────────────────────
  function handleToggle(keyId: string, currentStatus: boolean) {
    startTransition(async () => {
      await toggleApiKeyAction(keyId, !currentStatus)
      setKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive: !currentStatus } : k))
    })
  }

  // ─── Delete Key ────────────────────────────────────────────────────────────
  function handleDelete(keyId: string) {
    if (!confirm('Yakin hapus API key ini? Tindakan ini tidak dapat dibatalkan.')) return
    startTransition(async () => {
      await deleteApiKeyAction(keyId)
      setKeys(prev => prev.filter(k => k.id !== keyId))
    })
  }

  const formatDate = (d: Date | null) => {
    if (!d) return 'Belum pernah'
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))
  }

  const th: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: 'var(--surface-2)',
    textAlign: 'left',
  }

  const td: React.CSSProperties = {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>🔑 Open API</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Kelola akses API key dan dokumentasi endpoint Open API read-only (<code>/api/v1/*</code>)
        </p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem' }}>
        {(['keys', 'docs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'var(--transition)',
            }}
          >
            {tab === 'keys' ? '🔑 API Keys' : '📖 Dokumentasi API'}
          </button>
        ))}
      </div>

      {/* ── TAB: API KEYS ───────────────────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div>
          {/* Generate Key Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.4rem' }}>Buat API Key Baru</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              API key digunakan oleh aplikasi pihak ketiga untuk mengakses Open API read-only (<code>/api/v1/*</code>).
              Lihat rincian endpoint di tab <button onClick={() => setActiveTab('docs')} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>Dokumentasi API</button>.
            </p>

            {error && (
              <div style={{ padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Nama aplikasi konsumen (mis. Garda Lapang)"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                style={{ flex: '1 1 280px', maxWidth: 400 }}
                disabled={isPending}
              />
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={isPending}
              >
                {isPending ? '⏳ Generating...' : '+ Generate Key'}
              </button>
            </div>

            {/* One-time Key Display */}
            {newRawKey && (
              <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>✅ API Key berhasil dibuat!</span>
                  <span style={{ background: '#dc2626', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>SEKALI TAMPIL</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.85rem' }}>
                  Salin key ini sekarang. Setelah Anda menutup notifikasi ini, key <strong>tidak dapat ditampilkan lagi</strong>.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ flex: 1, padding: '0.6rem 0.85rem', background: '#1e293b', color: '#a7f3d0', borderRadius: 'var(--radius-xs)', fontSize: '0.875rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {newRawKey}
                  </code>
                  <button
                    className="btn btn-outline"
                    onClick={handleCopy}
                    style={{ flexShrink: 0 }}
                  >
                    {copied ? '✅ Tersalin!' : '📋 Salin'}
                  </button>
                </div>
                <button
                  onClick={() => setNewRawKey(null)}
                  style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Tutup notifikasi ini
                </button>
              </div>
            )}
          </div>

          {/* Keys Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Nama Aplikasi</th>
                  <th style={th}>Key (Prefix)</th>
                  <th style={th}>Status</th>
                  <th style={th}>Terakhir Dipakai</th>
                  <th style={th}>Dibuat</th>
                  <th style={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Belum ada API key. Buat key baru di atas.
                    </td>
                  </tr>
                ) : (
                  keys.map(k => (
                    <tr key={k.id} style={{ background: k.isActive ? 'transparent' : '#fafafa' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{k.name}</td>
                      <td style={td}>
                        <code style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{k.keyPrefix}</code>
                      </td>
                      <td style={td}>
                        {k.isActive
                          ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>Aktif</span>
                          : <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>Nonaktif</span>
                        }
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{formatDate(k.lastUsedAt)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{formatDate(k.createdAt)}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', color: k.isActive ? '#b45309' : '#15803d', borderColor: k.isActive ? '#fde68a' : '#bbf7d0' }}
                            onClick={() => handleToggle(k.id, k.isActive)}
                            disabled={isPending}
                          >
                            {k.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => handleDelete(k.id)}
                            disabled={isPending}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: DOKUMENTASI API ────────────────────────────────────────────── */}
      {activeTab === 'docs' && (
        <div>
          {/* Autentikasi Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Autentikasi</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Kirim API key pada header{' '}
              <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Authorization: Bearer &lt;key&gt;</code>{' '}
              atau{' '}
              <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>x-api-key: &lt;key&gt;</code>.{' '}
              Key dibuat oleh superadmin di tab{' '}
              <button onClick={() => setActiveTab('keys')} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>
                API Keys
              </button>.{' '}
              Rate limit: <strong>300 request/menit per key</strong> (HTTP 429 bila terlampaui).
            </p>

            <div style={{ background: '#1e293b', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', marginBottom: '1rem', overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: '#a7f3d0', fontSize: '0.82rem', fontFamily: 'monospace', whiteSpace: 'pre' }}>
{`curl -H "Authorization: Bearer sk_xxxxxxxx" \\
  "https://<domain>/api/v1/demoplot?from=2026-09-01&to=2026-09-30"`}
              </pre>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Spesifikasi machine-readable (OpenAPI 3.0):{' '}
              <a href="/api/v1/openapi" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                /api/v1/openapi
              </a>
            </p>
          </div>

          {/* Endpoint Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '25%' }}>Endpoint</th>
                  <th style={{ ...th, width: '40%' }}>Deskripsi</th>
                  <th style={th}>Query Parameters</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(ep => (
                  <tr key={ep.path}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', flexShrink: 0 }}>
                          {ep.method}
                        </span>
                        <code style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{ep.path}</code>
                      </div>
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{ep.desc}</td>
                    <td style={{ ...td, color: 'var(--text-light)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{ep.params}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Response Format */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Format Response</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Semua endpoint mengembalikan JSON dengan field <code>data</code> (array) dan <code>meta</code> (paginasi).
            </p>
            <div style={{ background: '#1e293b', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: '#a7f3d0', fontSize: '0.82rem', fontFamily: 'monospace', whiteSpace: 'pre' }}>
{`{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 124,
    "hasMore": true
  }
}`}
              </pre>
            </div>
          </div>

          {/* Error Codes */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Kode Error</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '15%' }}>HTTP Status</th>
                  <th style={th}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: '200 OK', desc: 'Request berhasil. Data dikembalikan dalam field data.' },
                  { code: '401 Unauthorized', desc: 'API key tidak ditemukan, tidak valid, atau sudah dinonaktifkan.' },
                  { code: '429 Too Many Requests', desc: 'Rate limit 300 request/menit terlampaui. Tunggu hingga window berikutnya.' },
                  { code: '500 Internal Server Error', desc: 'Terjadi kesalahan di server. Hubungi admin.' },
                ].map(row => (
                  <tr key={row.code}>
                    <td style={td}><code style={{ fontWeight: 700 }}>{row.code}</code></td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
