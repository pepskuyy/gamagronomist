'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react'
import { usePendingDraftCount } from '@/hooks/usePendingDraftCount'

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const pendingCount = usePendingDraftCount()
  const [justSynced, setJustSynced] = useState(false)

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

  // Jumlah draft di-poll bersama via usePendingDraftCount (termasuk refresh
  // saat SW mengirim SYNC_COMPLETE/DRAFT_SYNCED). Di sini cukup tampilkan
  // indikator "Tersinkronisasi!" sesaat.
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_COMPLETE') {
        setJustSynced(true)
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => setJustSynced(false), 4000)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      if (hideTimer) clearTimeout(hideTimer)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [])

  if (justSynced) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-xs)',
        background: 'var(--success-bg)', color: 'var(--success)',
        fontSize: '0.78rem', fontWeight: 500,
        animation: 'fadeIn 0.3s ease'
      }}>
        <CheckCircle2 size={14} strokeWidth={1.75} />
        Tersinkronisasi!
      </div>
    )
  }

  if (!isOnline) {
    return (
      <Link href="/dashboard/offline-queue" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-xs)',
          background: 'var(--warning-bg)', color: 'var(--warning)',
          fontSize: '0.78rem', fontWeight: 500,
          cursor: 'pointer'
        }}>
          <WifiOff size={14} strokeWidth={1.75} />
          Offline
          {pendingCount > 0 && (
            <span style={{
              background: 'var(--warning)', color: '#fff',
              borderRadius: '999px', padding: '0 0.375rem',
              fontSize: '0.7rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums'
            }}>
              {pendingCount}
            </span>
          )}
        </div>
      </Link>
    )
  }

  if (pendingCount > 0) {
    return (
      <Link href="/dashboard/offline-queue" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-xs)',
          background: 'var(--info-bg)', color: 'var(--info)',
          fontSize: '0.78rem', fontWeight: 500,
          cursor: 'pointer'
        }}>
          <RefreshCw size={14} strokeWidth={1.75} />
          Sinkronisasi...
          <span style={{
            background: 'var(--info)', color: '#fff',
            borderRadius: '999px', padding: '0 0.375rem',
            fontSize: '0.7rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums'
          }}>
            {pendingCount}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem',
      fontSize: '0.75rem', color: 'var(--text-muted)'
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
      Online
    </div>
  )
}
