'use client'

/**
 * useOfflineDraft.ts
 * React hook untuk mengelola draft offline.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  saveDraft as dbSaveDraft,
  type ReportType,
  type PhotoBlob,
} from '@/lib/offline-db'
import { usePendingDraftCount, refreshPendingDraftCount } from '@/hooks/usePendingDraftCount'

interface UseOfflineDraftResult {
  isOnline: boolean
  pendingCount: number
  saveDraft: (formData: Record<string, any>, photoBlobs: PhotoBlob[]) => Promise<string>
  triggerSync: () => void
}

export function useOfflineDraft(type: ReportType): UseOfflineDraftResult {
  const [isOnline, setIsOnline] = useState(true)
  // Polling bersama (satu interval untuk seluruh app, pause saat tab hidden)
  const pendingCount = usePendingDraftCount()

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

      // Refresh pending count (semua subscriber ikut ter-update)
      await refreshPendingDraftCount()

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
