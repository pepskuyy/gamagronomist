import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ExecuteForm from './ExecuteForm'
import { getStockBalance } from '@/lib/ledger/stock'

const prisma = new PrismaClient()

export default async function ExecuteDemoPlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return redirect('/login')

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      farmer: true,
      details: { include: { product: true } }
    }
  })

  if (!request || request.status !== 'APPROVED') {
    return (
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <h3>Pengajuan Tidak Valid atau Belum Disetujui</h3>
        <Link href="/dashboard/demoplot" style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block' }}>
          Kembali ke Daftar
        </Link>
      </div>
    )
  }

  // Ambil saldo aktual FO saat ini untuk validasi input usage max
  const foStocks = await getStockBalance(session.userId)

  const approvedProducts = request.details.map(d => {
    const onHand = foStocks.find(s => s.product.id === d.productId)?.quantity || 0
    return {
      id: d.id,
      productId: d.productId,
      name: d.product.name,
      unit: d.product.unit,
      qtyApproved: d.qtyApproved || 0,
      stockOnHand: onHand
    }
  })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Realisasi Demo Plot (Sesi)</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--surface-hover)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div><strong>Petani:</strong> {request.farmer?.name}</div>
          <div><strong>Area:</strong> {request.area}</div>
          <div><strong>Komoditas:</strong> {request.commodity}</div>
          <div><strong>Rencana:</strong> {request.plan}</div>
        </div>
      </div>

      <ExecuteForm 
        requestId={request.id} 
        products={approvedProducts} 
      />
    </div>
  )
}
