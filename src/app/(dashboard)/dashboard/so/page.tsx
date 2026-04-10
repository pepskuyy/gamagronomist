import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SoTrackingClient from './SoTrackingClient'

export default async function SoTrackingPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) redirect('/login')
  if (!['SPV', 'ADMIN', 'BD'].includes(session.role)) redirect('/dashboard')

  return <SoTrackingClient />
}
