'use client'

import { useState, useEffect } from 'react'
import { countPendingDrafts } from '@/lib/offline-db'
import Link from 'next/link'

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
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

  useEffect(() => {
    const refresh = async () => {
      const count = await countPendingDrafts()
      setPendingCount(count)
    }
    refresh()
    const timer = setInterval(refresh, 5000)

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_COMPLETE') {
        setJustSynced(true)
        setTimeout(() => setJustSynced(false), 4000)
        refresh()
      }
      if (e.data?.type === 'DRAFT_SYNCED') {
        refresh()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      clearInterval(timer)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [])

  if (justSynced) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.3rem 0.75rem', borderRadius: '999px',
        background: '#dcfce7', color: '#15803d',
        fontSize: '0.78rem', fontWeight: 600,
        border: '1px solid #86efac',
        animation: 'fadeIn 0.3s ease'
      }}>
        ✅ Tersinkronisasi!
      </div>
    )
  }

  if (!isOnline) {
    return (
      <Link href="/dashboard/offline-queue" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: '999px',
          background: '#fef3c7', color: '#92400e',
          fontSize: '0.78rem', fontWeight: 600,
          border: '1px solid #fde68a', cursor: 'pointer'
        }}>
          📵 Offline
          {pendingCount > 0 && (
            <span style={{
              background: '#f59e0b', color: 'white',
              borderRadius: '999px', padding: '0 0.4rem',
              fontSize: '0.7rem', fontWeight: 700
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
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: '999px',
          background: '#eff6ff', color: '#1d4ed8',
          fontSize: '0.78rem', fontWeight: 600,
          border: '1px solid #bfdbfe', cursor: 'pointer'
        }}>
          ⏳ Sinkronisasi...
          <span style={{
            background: '#3b82f6', color: 'white',
            borderRadius: '999px', padding: '0 0.4rem',
            fontSize: '0.7rem', fontWeight: 700
          }}>
            {pendingCount}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.75rem', color: 'var(--text-muted)'
    }}>
      <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>●</span>
      Online
    </div>
  )
}
