import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import Link from 'next/link'

export default async function StockDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const myStocks = await getStockBalance(session.userId)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>📦 Saldo Stok Saat Ini</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {session.role === 'AFA' && (
             <Link href="/dashboard/stock/in">
                <button className="btn btn-primary">➕ Input Stok Masuk</button>
             </Link>
          )}
          <Link href="/dashboard/stock/history">
            <button className="btn btn-outline">🕒 Histori Ledger</button>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {myStocks.map((stock) => (
          <div key={stock.product.id} className="card">
            <h3 style={{ fontSize: '1.125rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {stock.product.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
               <span style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--primary)' }}>
                 {stock.quantity}
               </span>
               <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                 {stock.product.unit}
               </span>
            </div>
          </div>
        ))}
        {myStocks.length === 0 && (
           <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem' }}>
             <p style={{ color: 'var(--text-muted)' }}>Saldo stok Anda saat ini kosong.</p>
           </div>
        )}
      </div>

      {['SPV', 'AFA'].includes(session.role) && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>👀 Pantauan FO</h2>
          <div className="card">
            <p style={{ color: 'var(--text-muted)' }}>Fitur pemantauan stok FO di area akan tampil di sini.</p>
          </div>
        </div>
      )}
    </div>
  )
}
