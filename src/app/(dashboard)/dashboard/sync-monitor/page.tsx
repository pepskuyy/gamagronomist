import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth'
import SyncMonitorClient from './SyncMonitorClient'

export const dynamic = 'force-dynamic'

export default async function SyncMonitorPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (!session?.userId || session.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return <SyncMonitorClient userRole={session.role} />
}
