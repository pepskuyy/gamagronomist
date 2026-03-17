import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function LedgerHistoryPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const ledgers = await prisma.ledger.findMany({
    where: { userId: session.userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limit 50 latest transactions
  })

  // Format type to readable badge
  const formatType = (type: string) => {
    switch (type) {
      case 'STOCK_IN_GUDANG': return <span className="badge badge-success">Stok Masuk Gudang</span>
      case 'TRANSFER_TO_FO': return <span className="badge badge-warning">Transfer Keluar ke FO</span>
      case 'RECEIVE_FROM_AFA': return <span className="badge badge-success">Terima dari AFA</span>
      case 'USAGE_DEMOPLOT': return <span className="badge badge-danger">Pemakaian Demo Plot</span>
      case 'DIRECT_USAGE_AFA': return <span className="badge badge-danger">Pemakaian Langsung</span>
      case 'ADJUSTMENT_PLUS': return <span className="badge badge-success">Koreksi Stok (+)</span>
      case 'ADJUSTMENT_MINUS': return <span className="badge badge-danger">Koreksi Stok (-)</span>
      default: return <span className="badge badge-neutral">{type}</span>
    }
  }

  return (
    <div>
      <div className="back-header">
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Histori Transaksi (Ledger)</h2>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis Transaksi</th>
                <th>Produk</th>
                <th>Kuantitas</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((item) => (
                <tr key={item.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(item.createdAt)}
                  </td>
                  <td>{formatType(item.transactionType)}</td>
                  <td style={{ fontWeight: 500, color: 'var(--primary)' }}>
                    {item.product.name}
                  </td>
                  <td>
                    <span style={{ 
                      color: item.quantity > 0 ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 700 
                    }}>
                      {item.quantity > 0 ? '+' : ''}{item.quantity} {item.product.unit}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.notes || '-'}</td>
                </tr>
              ))}
              {ledgers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada histori transaksi stok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
