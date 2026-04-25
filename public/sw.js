// Service Worker untuk Agrolens PWA
// Strategi: Network First dengan fallback offline untuk halaman utama

const CACHE_NAME = 'agrolens-v1'

// Aset statis yang selalu di-cache
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Install: cache aset statis
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Jika ada yang gagal, lanjutkan tetap
        return Promise.resolve()
      })
    })
  )
  self.skipWaiting()
})

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: Network First untuk API, Cache First untuk aset statis
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET dan chrome-extension
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // API calls: selalu Network, tidak di-cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Tidak ada koneksi internet.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Halaman & aset: Network First, fallback ke cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache response baru jika berhasil
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>🌐 Tidak Ada Koneksi</h2><p>Periksa koneksi internet Anda dan coba lagi.</p><a href="/" style="color:#1a9b55">← Kembali</a></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
        )
      )
  )
})
