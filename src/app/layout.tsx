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
        {/* Register Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
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
                        
                        caches.open('agrolens-v3').then(function(cache) {
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
