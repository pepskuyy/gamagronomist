// ============================================================
// Service Worker — Agrolens PWA  v3
// Strategi:
//   /_next/static/**  → Cache First (aset immutable, fingerprinted)
//   emsifa.github.io  → Cache First (data wilayah, jarang berubah)
//   /dashboard/**     → Stale-While-Revalidate (serve cache, update di background)
//   /api/**           → Network Only (tidak di-cache, kecuali error)
//   lainnya           → Network First dengan fallback cache
// ============================================================

const CACHE_NAME = 'agrolens-v3'
const DB_NAME = 'agrolens-offline'
const DB_VERSION = 1
const STORE = 'pending-reports'

// Halaman yang di-pre-cache saat install (App Shell)
// Hanya halaman statis / form yang aman di-cache
const PRECACHE_URLS = [
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ── Install ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => Promise.resolve())
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

  // 1. Next.js static assets: Cache First (immutable, selalu fresh)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // 2. EMSIFA Wilayah API: Cache First (data jarang berubah)
  if (url.hostname === 'emsifa.github.io') {
    event.respondWith(cacheFirst(request))
    return
  }

  // 3. Cloudinary / CDN aset gambar: Cache First
  if (url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // 4. API calls: Network Only (data realtime)
  //    Jika offline → kembalikan JSON error agar app tidak crash
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline', message: 'Tidak ada koneksi internet.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )
    return
  }

  // 5. Halaman dashboard: Stale-While-Revalidate
  //    Serve dari cache DULU (cepat), update cache di background
  if (url.pathname.startsWith('/dashboard') || url.pathname === '/') {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // 6. Semua lainnya: Network First dengan fallback cache
  event.respondWith(networkFirst(request))
})

// ── Strategi Cache ─────────────────────────────────────────────────

/** Cache First: serve cache, baru fetch jika belum ada di cache */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('', { status: 503 })
  }
}

/** Stale-While-Revalidate: serve cache dulu, update cache di background */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  // Update cache di background (tidak menunggu)
  const networkUpdate = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (cached) {
    // Serve dari cache langsung, update jalan di background
    return cached
  }

  // Belum ada cache → tunggu network
  try {
    const response = await networkUpdate
    if (response) return response
  } catch {
    // ignore
  }

  // Network juga gagal → offline fallback page
  return offlineFallbackPage()
}

/** Network First: coba network, fallback ke cache */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || offlineFallbackPage()
  }
}

function offlineFallbackPage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agrolens — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
    .card { background: white; border-radius: 16px; padding: 3rem 2.5rem; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.4rem; color: #1e293b; margin-bottom: 0.75rem; }
    p { color: #64748b; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn { display: inline-block; background: #1a9b55; color: white; padding: 0.75rem 2rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer; }
    .tip { background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 1rem; font-size: 0.82rem; color: #15803d; text-align: left; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📵</div>
    <h1>Tidak Ada Koneksi Internet</h1>
    <p>Halaman ini belum tersimpan di cache. Namun Anda masih bisa mengakses halaman yang pernah dikunjungi sebelumnya.</p>
    <button class="btn" onclick="history.back()">← Kembali</button>
    <div class="tip">
      <strong>💡 Tips:</strong> Buka halaman form laporan (Spot Demplot, Customer Behavior) terlebih dahulu saat ada sinyal agar tersimpan di cache dan bisa diakses offline.
    </div>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// ── IndexedDB Helper (raw IDB API, compatible dengan SW context) ───
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

// ── Background Sync ────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncAllPendingReports())
  }
})

// ── Manual sync trigger ────────────────────────────────────────────
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
      draft.status = 'syncing'
      await idbPut(db, STORE, draft)

      // Step 1: Upload foto blobs ke Cloudinary
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
          console.warn('[SW] Gagal upload foto:', uploadErr)
        }
      }

      // Step 2: Submit ke sync endpoint
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
        credentials: 'include',
      })

      if (syncRes.ok) {
        draft.status = 'synced'
        draft.syncedAt = new Date().toISOString()
        await idbPut(db, STORE, draft)
        successCount++

        const clients = await self.clients.matchAll({ includeUncontrolled: true })
        clients.forEach((client) =>
          client.postMessage({ type: 'DRAFT_SYNCED', draftId: draft.id })
        )
      } else {
        const errText = await syncRes.text().catch(() => 'Unknown')
        draft.status = 'failed'
        draft.errorMsg = `Server ${syncRes.status}: ${errText.slice(0, 200)}`
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
