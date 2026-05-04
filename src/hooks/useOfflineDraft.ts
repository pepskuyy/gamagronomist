'use client'

/**
 * useOfflineDraft.ts
 * React hook untuk mengelola draft offline.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  saveDraft as dbSaveDraft,
  countPendingDrafts,
  type ReportType,
  type PhotoBlob,
} from '@/lib/offline-db'

interface UseOfflineDraftResult {
  isOnline: boolean
  pendingCount: number
  saveDraft: (formData: Record<string, any>, photoBlobs: PhotoBlob[]) => Promise<string>
  triggerSync: () => void
}

export function useOfflineDraft(type: ReportType): UseOfflineDraftResult {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  // Deteksi status koneksi real-time
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

  // Poll pending count setiap 5 detik
  useEffect(() => {
    const refresh = async () => {
      const count = await countPendingDrafts()
      setPendingCount(count)
    }
    refresh()
    const timer = setInterval(refresh, 5000)

    // Dengarkan message dari Service Worker (saat draft berhasil sync)
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'DRAFT_SYNCED' || e.data?.type === 'SYNC_COMPLETE') {
        refresh()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      clearInterval(timer)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [])

  const saveDraft = useCallback(
    async (formData: Record<string, any>, photoBlobs: PhotoBlob[]): Promise<string> => {
      const id = await dbSaveDraft(type, formData, photoBlobs)

      // Daftarkan Background Sync ke Service Worker
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        try {
          await (reg as any).sync.register('sync-reports')
        } catch {
          // Background Sync tidak didukung (iOS Safari) — sync akan dipicu manual
        }
      }

      // Refresh pending count
      const count = await countPendingDrafts()
      setPendingCount(count)

      return id
    },
    [type]
  )

  const triggerSync = useCallback(async () => {
    // Kirim pesan ke Service Worker untuk trigger sync manual
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
    }
    // Fallback: langsung panggil sync endpoint dari browser jika SW tidak aktif
    if (isOnline) {
      try {
        await fetch('/api/reports/sync-offline', {
          method: 'PUT', // PUT = trigger manual sync dari browser tab
        })
      } catch {
        // ignore
      }
    }
  }, [isOnline])

  return { isOnline, pendingCount, saveDraft, triggerSync }
}
