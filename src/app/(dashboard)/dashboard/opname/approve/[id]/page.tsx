import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import ApproveClient from './ApproveClient'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const prisma = new PrismaClient()

export default async function OpnameApproveDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role as string)) {
    return <div className="card p-4">Akses Ditolak.</div>
  }

  const opname = await prisma.stockOpname.findUnique({
    where: { id },
    include: {
      user: {
        select: { name: true, role: true, area: { select: { name: true } } }
      },
      details: {
        include: {
          product: { select: { name: true, unit: true, unitGramasi: true, code: true } }
        }
      }
    }
  })

  if (!opname) {
    redirect('/dashboard/opname')
  }

  return (
    <div className="space-y-6">
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/opname" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
          <h2 style={{ margin: 0 }}>Review Opname: {opname.user.name}</h2>
        </div>
      </div>

      <ApproveClient opname={opname} />
    </div>
  )
}
