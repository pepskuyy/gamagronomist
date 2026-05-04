'use client'

import { useState, useEffect } from 'react'
import { getAllDrafts, deleteDraft, updateDraftStatus, type PendingDraft } from '@/lib/offline-db'
import Link from 'next/link'

const TYPE_LABELS: Record<string, string> = {
  'spot-demplot': '🌿 Spot Demplot',
  'cb': '📝 Customer Behavior',
  'kios': '🏪 Visit Kios',
  'gathering': '🤝 Gathering',
  'company': '🏢 Visit Company',
  'video-konten': '📹 Video Konten',
}

const STATUS_BADGES: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:  { label: 'Menunggu Sinyal', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  syncing:  { label: 'Sedang Dikirim',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  synced:   { label: 'Terkirim ✓',      bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  failed:   { label: 'Gagal ✗',         bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
}

export default function OfflineQueuePage() {
  const [drafts, setDrafts] = useState<PendingDraft[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = async () => {
    const all = await getAllDrafts()
    setDrafts(all)
  }

  useEffect(() => {
    refresh()
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_COMPLETE' || e.data?.type === 'DRAFT_SYNCED') {
        refresh()
        setSyncing(false)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    const timer = setInterval(refresh, 5000)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
      clearInterval(timer)
    }
  }, [])

  const handleTriggerSync = async () => {
    setSyncing(true)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
    }
    // Fallback timeout
    setTimeout(() => {
      refresh()
      setSyncing(false)
    }, 10000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus draft ini? Data tidak bisa dikembalikan.')) return
    await deleteDraft(id)
    refresh()
  }

  const handleRetry = async (id: string) => {
    await updateDraftStatus(id, 'pending')
    refresh()
    if (isOnline) handleTriggerSync()
  }

  const pendingCount = drafts.filter(d => d.status === 'pending' || d.status === 'failed').length
  const selectedDraft = drafts.find(d => d.id === selectedId)

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div className="back-header" style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/reports" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>
          ← Kembali
        </Link>
        <h2 style={{ margin: 0 }}>📱 Antrian Laporan Offline</h2>
      </div>

      {/* Status bar */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>
            {isOnline
              ? '🟢 Terhubung ke Internet'
              : '📵 Tidak Ada Koneksi'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {pendingCount > 0
              ? `${pendingCount} laporan menunggu untuk dikirim`
              : 'Semua laporan sudah terkirim'}
          </div>
        </div>
        {pendingCount > 0 && isOnline && (
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {syncing ? '⏳ Mengirim...' : '📤 Kirim Semua Sekarang'}
          </button>
        )}
      </div>

      {/* Draft list */}
      {drafts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h3>Tidak Ada Draft Offline</h3>
          <p style={{ fontSize: '0.9rem' }}>Semua laporan sudah terkirim ke server.</p>
          <Link href="/dashboard/reports" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Lihat Laporan
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {drafts.map(draft => {
            const statusInfo = STATUS_BADGES[draft.status] || STATUS_BADGES.pending
            const isSelected = selectedId === draft.id
            return (
              <div
                key={draft.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  transition: 'border-color 0.15s'
                }}
                onClick={() => setSelectedId(isSelected ? null : draft.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {TYPE_LABELS[draft.type] || draft.type}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        📅 {new Date(draft.createdAt).toLocaleString('id-ID')}
                        {' · '}
                        📸 {draft.photoBlobs?.length || 0} foto
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                      background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.border}`
                    }}>
                      {statusInfo.label}
                    </span>
                    {(draft.status === 'pending' || draft.status === 'failed') && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRetry(draft.id) }}
                        style={{
                          padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'var(--primary)',
                          color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
                        }}
                      >
                        Coba Lagi
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(draft.id) }}
                      style={{
                        padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'none',
                        color: 'var(--danger)', border: '1px solid var(--danger)',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer'
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    {draft.errorMsg && (
                      <div style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                        ⚠️ Error: {draft.errorMsg}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                      {Object.entries(draft.formData || {}).slice(0, 10).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{k}: </span>
                          <span>{String(v).slice(0, 60)}</span>
                        </div>
                      ))}
                    </div>
                    {(draft.photoBlobs?.length ?? 0) > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          Preview Foto (tersimpan lokal):
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {draft.photoBlobs.map((p, i) => (
                            p.previewUrl ? (
                              <img
                                key={i}
                                src={p.previewUrl}
                                alt={`foto ${i + 1}`}
                                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                onError={e => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              <div key={i} style={{
                                width: '60px', height: '60px', background: 'var(--surface-2)',
                                borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '1.5rem'
                              }}>📷</div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
