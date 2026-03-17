import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStockBalance } from '@/lib/ledger/stock'
import { approveRequest, rejectRequest } from '@/app/actions/approve'

const prisma = new PrismaClient()

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (session?.role !== 'AFA' && session?.role !== 'ADMIN') {
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

  // AFA Needs to see their stock to know if they can approve
  const afaStocks = await getStockBalance(session.userId)
  
  const getStockForProduct = (productId: string) => {
    const stock = afaStocks.find(s => s.product.id === productId)
    return stock ? stock.quantity : 0
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Review Pengajuan dari FO</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Detail Pengajuan</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Field Officer (FO)</p>
             <p style={{ fontWeight: 600 }}>{request.fo.name}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Tanggal Pengajuan</p>
             <p style={{ fontWeight: 600 }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(request.createdAt)}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Petani & Wilayah</p>
             <p style={{ fontWeight: 600 }}>{request.farmer?.name} - {request.area}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Komoditas</p>
             <p style={{ fontWeight: 600 }}>{request.commodity}</p>
           </div>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
           <p className="form-label" style={{ marginBottom: '0.2rem' }}>Masalah (CB)</p>
           <p style={{ background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: '4px' }}>{request.problem}</p>
        </div>
        <div>
           <p className="form-label" style={{ marginBottom: '0.2rem' }}>Rencana Eksekusi</p>
           <p style={{ background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: '4px' }}>{request.plan}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Produk yang Diajukan</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Produk</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Qty Diajukan</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Stok AFA Anda</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Status Stok</th>
              </tr>
            </thead>
            <tbody>
              {request.details.map(d => {
                const stockOnHand = getStockForProduct(d.productId)
                const isSufficient = stockOnHand >= d.qtyRequested
                return (
                  <tr key={d.id}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{d.product.name}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                      {d.qtyRequested} {d.product.unit}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      {stockOnHand} {d.product.unit}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      {isSufficient ? (
                        <span className="badge badge-success">Aman</span>
                      ) : (
                        <span className="badge badge-danger">Kurang</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <form action={rejectRequest} style={{ flex: 1 }}>
           <input type="hidden" name="requestId" value={request.id} />
           <button type="submit" className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
             ❌ Tolak Pengajuan
           </button>
        </form>
        
        <form action={approveRequest} style={{ flex: 2 }}>
           <input type="hidden" name="requestId" value={request.id} />
           <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'var(--primary)', color: 'white' }}>
             ✅ Setujui & Transfer Stok
           </button>
        </form>
      </div>
    </div>
  )
}
