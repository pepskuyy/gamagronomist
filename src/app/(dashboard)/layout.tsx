import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'
import prisma from '@/lib/prisma'

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
  let isMaintenance = false
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'maintenance_mode' } })
    if (config?.value === 'true') {
      isMaintenance = true
    }
  } catch (error) {
    // If DB is completely down (e.g. during major migrations), assume maintenance mode
    isMaintenance = true
  }

  if (isMaintenance && session.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: '#dc2626' }}>🚧 Mode Maintenance 🚧</h1>
        <p style={{ fontSize: '1.1rem', color: '#4b5563', maxWidth: '600px', lineHeight: 1.6 }}>
          Sistem sedang dalam tahap pemeliharaan <em>(maintenance)</em> untuk peningkatan performa atau migrasi database.
          Mohon kembali beberapa saat lagi.
        </p>
        <p style={{ marginTop: '2.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
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
