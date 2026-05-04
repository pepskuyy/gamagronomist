// ============================================================
// Service Worker — Agrolens PWA
// Mendukung: Network-first caching + Offline Background Sync
// ============================================================

const CACHE_NAME = 'agrolens-v2'
const DB_NAME = 'agrolens-offline'
const DB_VERSION = 1
const STORE = 'pending-reports'

const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ── Install ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => Promise.resolve())
    )
  )
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch ──────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'Tidak ada koneksi internet.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(
        () =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(
                '<html><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>🌐 Tidak Ada Koneksi</h2><p>Data Anda sudah tersimpan offline dan akan otomatis terkirim saat sinyal tersedia.</p><a href="/" style="color:#1a9b55">← Kembali</a></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
          )
      )
  )
})

// ── IndexedDB Helper (raw IDB API, compatible with SW context) ────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('status', 'status')
      }
    }
  })
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Background Sync ────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncAllPendingReports())
  }
})

// ── Manual sync trigger dari main thread ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'TRIGGER_SYNC') {
    syncAllPendingReports()
  }
})

async function syncAllPendingReports() {
  let db
  try {
    db = await openIDB()
  } catch (err) {
    console.error('[SW] Gagal buka IndexedDB:', err)
    return
  }

  const all = await idbGetAll(db, STORE)
  const pending = all.filter((d) => d.status === 'pending' || d.status === 'failed')

  if (pending.length === 0) return

  let successCount = 0

  for (const draft of pending) {
    try {
      // Mark as syncing
      draft.status = 'syncing'
      await idbPut(db, STORE, draft)

      // Step 1: Upload setiap photo blob ke Cloudinary via /api/upload
      const photoUrls = []
      for (const photoEntry of draft.photoBlobs || []) {
        try {
          const fd = new FormData()
          fd.append('file', photoEntry.blob, photoEntry.filename || 'photo.jpg')
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
          if (uploadRes.ok) {
            const { url } = await uploadRes.json()
            photoUrls.push(url)
          }
        } catch (uploadErr) {
          console.warn('[SW] Gagal upload foto, skip:', uploadErr)
        }
      }

      // Step 2: Submit form data ke sync endpoint
      const payload = {
        ...draft.formData,
        photos: JSON.stringify(photoUrls),
        type: draft.type,
        _offlineDraftId: draft.id,
      }

      const syncRes = await fetch('/api/reports/sync-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include', // kirim cookie session
      })

      if (syncRes.ok) {
        draft.status = 'synced'
        draft.syncedAt = new Date().toISOString()
        await idbPut(db, STORE, draft)
        successCount++

        // Beritahu semua open tabs
        const clients = await self.clients.matchAll({ includeUncontrolled: true })
        clients.forEach((client) =>
          client.postMessage({ type: 'DRAFT_SYNCED', draftId: draft.id })
        )
      } else {
        const errText = await syncRes.text().catch(() => 'Unknown error')
        draft.status = 'failed'
        draft.errorMsg = `Server error ${syncRes.status}: ${errText.slice(0, 200)}`
        await idbPut(db, STORE, draft)
      }
    } catch (err) {
      draft.status = 'failed'
      draft.errorMsg = err.message || 'Network error'
      await idbPut(db, STORE, draft)
    }
  }

  if (successCount > 0) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true })
    clients.forEach((client) =>
      client.postMessage({ type: 'SYNC_COMPLETE', count: successCount })
    )
  }
}
