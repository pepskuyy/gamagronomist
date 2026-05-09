// ============================================================
// Service Worker — Agrolens PWA  v4
//
// Strategi:
//   /_next/static/**   → Cache First (aset immutable, fingerprinted)
//   RSC requests       → Network Only (Next.js client navigation — JANGAN cache)
//   /api/products      → Stale-While-Revalidate (dibutuhkan form offline)
//   /api/cb-farmers    → Stale-While-Revalidate (dibutuhkan form offline)
//   /api/stock/balance → Stale-While-Revalidate (dibutuhkan form offline)
//   /api/**            → Network Only (data realtime, error JSON saat offline)
//   emsifa.github.io   → Cache First (data wilayah, jarang berubah)
//   Cloudinary CDN     → Cache First
//   /dashboard/**      → Network First + fallback cache
//                        (fresh data setelah mutasi, tapi bisa dibuka offline)
//   lainnya            → Network First dengan fallback cache
//
// Fix v4:
//   1. RSC requests di-exclude dari cache → UI tidak lagi "nyangkut" setelah approval
//   2. Dashboard → Network First (bukan SWR) → data selalu fresh, tetap ada fallback
//   3. Tambah /api/products + /api/cb-farmers ke SWR → form bisa diisi offline
//   4. Tambah halaman form ke PRECACHE_URLS → bisa dibuka tanpa internet
//   5. CLEAR_PAGE_CACHE message → invalidasi cache on-demand setelah mutasi
// ============================================================

const CACHE_NAME = 'agrolens-v4'
const DB_NAME    = 'agrolens-offline'
const DB_VERSION = 1
const STORE      = 'pending-reports'

// URL yang di-pre-cache saat SW install (App Shell + halaman form penting)
const PRECACHE_URLS = [
  '/login',
  '/dashboard/demoplot/new',
  '/dashboard/reports/spot-demplot/new',
  '/dashboard/reports/cb/new',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// API yang dibutuhkan form saat offline (data master, jarang berubah)
const OFFLINE_DATA_APIS = [
  '/api/products',
  '/api/cb-farmers',
  '/api/stock/balance',
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

  // Abaikan non-GET dan non-http
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // ── 0. RSC (React Server Component) requests ───────────────────
  // Next.js App Router menggunakan request khusus saat client-side navigation.
  // Header RSC / Next-Router-State-Tree / ?_rsc= → WAJIB network only, jangan cache.
  // Ini adalah penyebab utama UI "nyangkut" setelah approval/mutasi.
  const isRSC = (
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree') !== null ||
    request.headers.get('Next-Router-Prefetch') !== null
  )
  if (isRSC) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('{"error":"offline"}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // ── 1. Next.js static assets: Cache First (immutable) ─────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // ── 2. Gambar Cloudinary: Cache First ─────────────────────────
  if (url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // ── 3. Data wilayah EMSIFA: Cache First ───────────────────────
  if (url.hostname === 'emsifa.github.io') {
    event.respondWith(cacheFirst(request))
    return
  }

  // ── 4. Data API offline (produk, petani CB, saldo stok) ───────
  // SWR: serve cache dulu, update di background. Butuh saat isi form offline.
  if (OFFLINE_DATA_APIS.some((p) => url.pathname === p || url.pathname.startsWith(p + '?'))) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // ── 5. API lainnya: Network Only ──────────────────────────────
  // Data realtime — jangan cache. Saat offline, kembalikan JSON error.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({ error: 'offline', message: 'Tidak ada koneksi internet.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
      )
    )
    return
  }

  // ── 6. Halaman dashboard & root: Network First ─────────────────
  // Network First menggantikan SWR untuk mencegah tampilan stale setelah mutasi.
  // Jika offline, fallback ke cache (termasuk halaman form yang di-precache).
  if (url.pathname.startsWith('/dashboard') || url.pathname === '/') {
    event.respondWith(networkFirst(request))
    return
  }

  // ── 7. Lainnya: Network First dengan fallback cache ────────────
  event.respondWith(networkFirst(request))
})

// ── Strategi Cache ─────────────────────────────────────────────────

/** Cache First: serve cache, fetch jika belum ada */
async function cacheFirst(request) {
  const cache  = await caches.open(CACHE_NAME)
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

/** Stale-While-Revalidate: serve cache dulu, update di background */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const networkUpdate = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (cached) return cached

  const response = await networkUpdate
  if (response) return response
  return offlineFallbackPage()
}

/** Network First: coba network, fallback ke cache, fallback ke offline page */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) })
    if (response.ok || response.status === 304) {
      // Hanya cache halaman HTML (bukan JSON, binary, dll)
      const ct = response.headers.get('content-type') || ''
      if (ct.includes('text/html')) {
        cache.put(request, response.clone())
      }
    }
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
    .btn { display: inline-block; background: #1a9b55; color: white; padding: 0.75rem 2rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer; margin: 0.25rem; }
    .btn-outline { background: transparent; border: 2px solid #1a9b55; color: #1a9b55; }
    .tip { background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 1rem; font-size: 0.82rem; color: #15803d; text-align: left; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📵</div>
    <h1>Mode Offline</h1>
    <p>Halaman ini membutuhkan koneksi internet. Namun Anda masih bisa mengakses halaman form yang pernah dibuka sebelumnya.</p>
    <button class="btn btn-outline" onclick="history.back()">← Kembali</button>
    <button class="btn" onclick="location.reload()">🔄 Coba Lagi</button>
    <div class="tip">
      <strong>💡 Form yang bisa diisi offline:</strong><br>
      • Rekam Demo Plot<br>
      • Spot Demplot<br>
      • Customer Behavior
    </div>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// ── IndexedDB Helper (native IDB API, compatible dengan SW context) ─
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
    const tx  = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbPut(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).put(record)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Message Handler ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  // Trigger manual sync
  if (event.data?.type === 'TRIGGER_SYNC') {
    syncAllPendingReports()
    return
  }

  // Invalidasi cache halaman tertentu setelah mutasi (approval, submit, dll)
  // Dikirim dari komponen UI setelah Server Action berhasil.
  if (event.data?.type === 'CLEAR_PAGE_CACHE') {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : []
    caches.open(CACHE_NAME).then((cache) => {
      urls.forEach((u) => {
        cache.delete(new Request(u))
        // Juga hapus dengan trailing slash jika ada
        cache.delete(new Request(u.endsWith('/') ? u.slice(0, -1) : u + '/'))
      })
    })
    return
  }
})

// ── Background Sync ────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncAllPendingReports())
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

  const all     = await idbGetAll(db, STORE)
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
        draft.status    = 'synced'
        draft.syncedAt  = new Date().toISOString()
        await idbPut(db, STORE, draft)
        successCount++

        const clients = await self.clients.matchAll({ includeUncontrolled: true })
        clients.forEach((client) =>
          client.postMessage({ type: 'DRAFT_SYNCED', draftId: draft.id })
        )
      } else {
        const errText    = await syncRes.text().catch(() => 'Unknown')
        draft.status     = 'failed'
        draft.errorMsg   = `Server ${syncRes.status}: ${errText.slice(0, 200)}`
        await idbPut(db, STORE, draft)
      }
    } catch (err) {
      draft.status   = 'failed'
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
