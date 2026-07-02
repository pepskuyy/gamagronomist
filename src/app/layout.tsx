import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agrolens - Tracking Stok & Demo Plot",
  description: "Portal agronomi untuk pelacakan barang, permintaan, dan aktivitas lapangan",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agrolens",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Agrolens",
    title: "Agrolens",
    description: "Portal Agronomi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1a9b55" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Agrolens" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </head>
      <body>
        {children}
        {/* Register Service Worker + Navigation Progress Bar */}
        <style dangerouslySetInnerHTML={{ __html: `
          #nav-progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            width: 0%;
            background: linear-gradient(90deg, #1a9b55, #4ade80);
            z-index: 99999;
            transition: width 0.2s ease, opacity 0.4s ease;
            opacity: 0;
            pointer-events: none;
            border-radius: 0 2px 2px 0;
            box-shadow: 0 0 8px rgba(26,155,85,0.6);
          }
          #nav-progress-bar.loading {
            opacity: 1;
            animation: nav-grow 1.2s ease-out forwards;
          }
          #nav-progress-bar.done {
            width: 100% !important;
            opacity: 0;
            transition: width 0.15s ease, opacity 0.5s ease 0.15s;
          }
          @keyframes nav-grow {
            0%   { width: 0%; }
            30%  { width: 40%; }
            60%  { width: 65%; }
            80%  { width: 80%; }
            100% { width: 90%; }
          }
        `}} />
        <div id="nav-progress-bar" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ── Navigation Progress Bar ──────────────────────────
              (function() {
                var bar = null;
                var timer = null;
                function getBar() {
                  if (!bar) bar = document.getElementById('nav-progress-bar');
                  return bar;
                }
                function startProgress() {
                  var b = getBar(); if (!b) return;
                  clearTimeout(timer);
                  b.className = 'loading';
                }
                function doneProgress() {
                  var b = getBar(); if (!b) return;
                  b.className = 'done';
                  timer = setTimeout(function() { b.className = ''; b.style.width = ''; }, 700);
                }
                // Hook into Next.js App Router via MutationObserver on <html> data attributes
                // which change during RSC navigation
                var prevPathname = location.pathname;
                function checkNavigation() {
                  if (location.pathname !== prevPathname) {
                    prevPathname = location.pathname;
                    doneProgress();
                  }
                }
                // Listen to popstate and click on <a> tags for SPA navigation start
                document.addEventListener('click', function(e) {
                  var a = e.target && e.target.closest('a[href]');
                  if (!a) return;
                  var href = a.getAttribute('href');
                  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
                  if (href !== location.pathname) startProgress();
                }, true);
                window.addEventListener('popstate', function() { startProgress(); });
                // Poll to detect when navigation is complete
                setInterval(checkNavigation, 100);
              })();

              // ── Service Worker Registration ───────────────────────
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('[SW] Registered');

                      // Pre-warm cache: simpan halaman penting saat online
                      // agar bisa diakses saat offline
                      if (navigator.onLine) {
                        var pagesToCache = [
                          '/dashboard',
                          '/dashboard/reports',
                          '/dashboard/reports/spot-demplot/new',
                          '/dashboard/reports/cb/new',
                          '/dashboard/reports/kios/new',
                          '/dashboard/reports/gathering/new',
                          '/dashboard/reports/company/new',
                          '/dashboard/offline-queue',
                        ];
                        
                        caches.open('agrolens-v5').then(function(cache) {
                          pagesToCache.forEach(function(url) {
                            fetch(url, { credentials: 'include' })
                              .then(function(res) {
                                if (res.ok) cache.put(url, res);
                              })
                              .catch(function() {});
                          });
                        });
                      }
                    })
                    .catch(function(err) { console.log('[SW] Error:', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
