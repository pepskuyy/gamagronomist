import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'
import prisma from '@/lib/prisma'
import { withRetry } from '@/lib/retry'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/login')
  }

  const session = await decrypt(sessionToken)

  if (!session?.userId) {
    redirect('/login')
  }

  // --- MAINTENANCE MODE CHECK ---
  // FAIL-OPEN: gangguan DB sesaat (pool timeout, cold start, connection reset)
  // TIDAK boleh mengunci seluruh user. Maintenance hanya aktif jika DB
  // benar-benar mengembalikan value 'true'.
  let isMaintenance = false
  try {
    const config = await withRetry(
      () => prisma.systemConfig.findUnique({ where: { key: 'maintenance_mode' } }),
      { maxAttempts: 2, initialDelayMs: 200, maxDelayMs: 400, label: 'maintenance_mode check' }
    )
    isMaintenance = config?.value === 'true'
  } catch (error) {
    // Gagal setelah retry — fail open, biarkan user tetap masuk.
    console.error('[maintenance-check] DB unreachable, fail-open:', error)
    isMaintenance = false
  }

  if (isMaintenance && session.role !== 'ADMIN') {
    return (
      <div
        data-sw-no-cache="1"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb' }}
      >
        {/*
          Self-cleaning: halaman ini bisa saja ter-cache oleh Service Worker.
          Script di bawah menghapus entry cache halaman ini agar tidak "nyangkut",
          lalu auto-reload berkala untuk mendeteksi maintenance sudah selesai.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      names.forEach(function(n) {
                        caches.open(n).then(function(c) {
                          c.delete(location.pathname);
                          c.delete(location.pathname + '/');
                          c.delete(location.href);
                        });
                      });
                    });
                  }
                } catch (e) {}
                setTimeout(function() { location.reload(); }, 30000);
              })();
            `,
          }}
        />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: '#dc2626' }}>🚧 Mode Maintenance 🚧</h1>
        <p style={{ fontSize: '1.1rem', color: '#4b5563', maxWidth: '600px', lineHeight: 1.6 }}>
          Sistem sedang dalam tahap pemeliharaan <em>(maintenance)</em> untuk peningkatan performa atau migrasi database.
          Mohon kembali beberapa saat lagi.
        </p>
        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Halaman ini akan menyegarkan otomatis setiap 30 detik.
        </p>
        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          Hanya Administrator yang dapat mengakses sistem saat ini.
        </p>
      </div>
    )
  }

  return (
    <DashboardShell session={{ name: session?.name || '', role: session?.role || '', photo: session?.photo || null }}>
      {children}
    </DashboardShell>
  )
}
