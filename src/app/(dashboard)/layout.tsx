import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'

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
  
  return (
    <DashboardShell session={{ name: session?.name || '', role: session?.role || '', photo: session?.photo || null }}>
      {children}
    </DashboardShell>
  )
}
