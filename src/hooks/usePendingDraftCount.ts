'use client'

/**
 * usePendingDraftCount
 *
 * Satu sumber polling bersama untuk jumlah draft offline (IndexedDB).
 * Sebelumnya ConnectionStatus, OfflineDraftBanner, dan useOfflineDraft
 * masing-masing polling setiap 5 detik (3x query IDB paralel).
 *
 * - Satu interval 5s dipakai bersama oleh semua subscriber.
 * - Polling berhenti saat tab tersembunyi; refresh segera saat tab kembali
 *   terlihat, saat online, atau saat Service Worker mengirim DRAFT_SYNCED /
 *   SYNC_COMPLETE.
 */

import { useEffect, useState } from 'react'
import { countPendingDrafts } from '@/lib/offline-db'

const POLL_MS = 5000

type Listener = (count: number) => void

const listeners = new Set<Listener>()
let currentCount = 0
let timer: ReturnType<typeof setInterval> | null = null
let started = false

async function refresh() {
  try {
    const count = await countPendingDrafts()
    currentCount = count
    listeners.forEach((l) => l(count))
  } catch {
    // IndexedDB tidak tersedia (mis. private mode) — abaikan
  }
}

function startTimer() {
  if (timer || typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') return
  timer = setInterval(refresh, POLL_MS)
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    stopTimer()
  } else {
    refresh()
    startTimer()
  }
}

function onSwMessage(e: MessageEvent) {
  if (e.data?.type === 'DRAFT_SYNCED' || e.data?.type === 'SYNC_COMPLETE') refresh()
}

function start() {
  if (started) return
  started = true
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', refresh)
  navigator.serviceWorker?.addEventListener('message', onSwMessage)
  refresh()
  startTimer()
}

function stop() {
  if (!started) return
  started = false
  stopTimer()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('online', refresh)
  navigator.serviceWorker?.removeEventListener('message', onSwMessage)
}

/** Paksa refresh jumlah draft (mis. setelah menyimpan / menghapus draft). */
export function refreshPendingDraftCount(): Promise<void> {
  return refresh()
}

export function usePendingDraftCount(): number {
  const [count, setCount] = useState(currentCount)

  useEffect(() => {
    listeners.add(setCount)
    if (listeners.size === 1) start()
    else refresh()
    return () => {
      listeners.delete(setCount)
      if (listeners.size === 0) stop()
    }
  }, [])

  return count
}
