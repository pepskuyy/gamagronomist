import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getStockBalance } from '@/lib/ledger/stock'
import ApproveClient from './ApproveClient'

const prisma = new PrismaClient()

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['AFA', 'PLANTATION'].includes(session?.role as string) && session?.role !== 'ADMIN') {
    return redirect('/dashboard')
  }

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      fo: true,
      farmer: true,
      details: { include: { product: true } }
    }
  })

  if (!request) return <div>Pengajuan tidak ditemukan</div>

  const afaStocks = await getStockBalance(session.userId)
  const stockSimple = afaStocks.map(s => ({ productId: s.product.id, quantity: s.quantity }))

  return (
    <ApproveClient
      request={{
        ...request,
        createdAt: request.createdAt.toISOString(),
      }}
      afaStocks={stockSimple}
    />
  )
}
