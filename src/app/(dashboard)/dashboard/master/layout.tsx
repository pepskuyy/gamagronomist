import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

// Master Data hanya untuk ADMIN/SPV (sebelumnya hanya disembunyikan di menu)
export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !['ADMIN', 'SPV'].includes(session.role)) redirect('/dashboard')
  return <>{children}</>
}
