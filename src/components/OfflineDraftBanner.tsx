'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePendingDraftCount } from '@/hooks/usePendingDraftCount'

export default function OfflineDraftBanner() {
  const pendingCount = usePendingDraftCount()
  const [isOnline, setIsOnline] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Reset dismiss saat antrean kosong (perilaku sama seperti sebelumnya)
  useEffect(() => {
    if (pendingCount === 0) setDismissed(false)
  }, [pendingCount])

  const handleManualSync = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
    }
  }

  if (pendingCount === 0 || dismissed) return null

  return (
    <div style={{
      background: isOnline ? '#eff6ff' : '#fef3c7',
      border: `1px solid ${isOnline ? '#bfdbfe' : '#fde68a'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{isOnline ? '⏳' : '📵'}</span>
        <div>
          <strong style={{ color: isOnline ? '#1d4ed8' : '#92400e', fontSize: '0.88rem' }}>
            {isOnline
              ? `${pendingCount} laporan offline sedang disinkronisasi...`
              : `${pendingCount} laporan tersimpan offline, menunggu sinyal`}
          </strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            {isOnline
              ? 'Service Worker akan otomatis mengirim data ke server.'
              : 'Data aman di perangkat. Akan otomatis dikirim saat koneksi tersedia.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {isOnline && (
          <button
            onClick={handleManualSync}
            style={{
              padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
              background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
            }}
          >
            Kirim Sekarang
          </button>
        )}
        <Link
          href="/dashboard/offline-queue"
          style={{
            padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
            background: 'transparent', color: isOnline ? '#1d4ed8' : '#92400e',
            border: `1px solid ${isOnline ? '#bfdbfe' : '#fde68a'}`,
            borderRadius: 'var(--radius-sm)', textDecoration: 'none'
          }}
        >
          Lihat Antrian
        </Link>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1rem', padding: '0.2rem'
          }}
          title="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
