import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Self-hosted Inter (variable font, termasuk axis opsz) — menggantikan
// @import Google Fonts yang render-blocking di globals.css.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-inter",
});

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
    <html lang="id" className={inter.variable}>
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
                // Polling pathname hanya berjalan SELAMA progress aktif
                // (sebelumnya setInterval 100ms berjalan terus-menerus).
                var poll = null;
                var safety = null;
                function stopPolling() {
                  if (poll) { clearInterval(poll); poll = null; }
                  if (safety) { clearTimeout(safety); safety = null; }
                }
                function startProgress() {
                  var b = getBar(); if (!b) return;
                  clearTimeout(timer);
                  b.className = 'loading';
                  stopPolling();
                  poll = setInterval(checkNavigation, 100);
                  // Pengaman: jangan biarkan bar menggantung bila navigasi batal
                  safety = setTimeout(doneProgress, 10000);
                }
                function doneProgress() {
                  stopPolling();
                  var b = getBar(); if (!b) return;
                  b.className = 'done';
                  timer = setTimeout(function() { b.className = ''; b.style.width = ''; }, 700);
                }
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
              })();

              // ── Service Worker Registration ───────────────────────
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('[SW] Registered');

                      // Pre-warm cache lewat SW (daftar URL & nama cache
                      // dikelola di sw.js agar tidak ada duplikasi/hardcode).
                      // SW juga menolak menyimpan response hasil redirect,
                      // sehingga halaman /login tidak pernah tersimpan
                      // sebagai /dashboard saat session expired.
                      // Throttle: prewarm maksimal 1x per 30 menit (sama dengan
                      // TTL cache HTML di sw.js) agar tidak memicu 8 render
                      // halaman server setiap kali page load.
                      var PREWARM_KEY = 'agrolens:lastPrewarm';
                      var PREWARM_INTERVAL = 30 * 60 * 1000;
                      function askPrewarm(force) {
                        if (!navigator.onLine) return;
                        var sw = reg.active || navigator.serviceWorker.controller;
                        if (!sw) return;
                        try {
                          var last = Number(localStorage.getItem(PREWARM_KEY) || 0);
                          if (!force && Date.now() - last < PREWARM_INTERVAL) return;
                          localStorage.setItem(PREWARM_KEY, String(Date.now()));
                        } catch (e) { /* localStorage tidak tersedia: tetap prewarm */ }
                        sw.postMessage({ type: 'PREWARM_PAGES' });
                      }

                      if (reg.active) askPrewarm();
                      else reg.addEventListener('updatefound', function() {
                        if (reg.installing) {
                          reg.installing.addEventListener('statechange', function() {
                            if (this.state === 'activated') askPrewarm(true);
                          });
                        }
                      });
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
