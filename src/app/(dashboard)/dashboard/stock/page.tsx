import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import { PrismaClient } from '@prisma/client'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function StockDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const myStocks = await getStockBalance(session.userId)

  // For AFA: fetch all FOs under this AFA and their stock balances
  let foStockData: { fo: { id: string; name: string }; stocks: { product: { id: string; name: string; unit: string }; quantity: number }[] }[] = []

  if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({
      where: { afaId: session.userId, role: 'FO' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    foStockData = await Promise.all(
      fos.map(async (fo) => ({
        fo,
        stocks: await getStockBalance(fo.id),
      }))
    )
  }

  // For SPV: fetch all AFAs in the area, and their FOs
  let spvFoData: { fo: { id: string; name: string; afa?: { name: string } | null }; stocks: { product: { id: string; name: string; unit: string }; quantity: number }[] }[] = []

  if (session.role === 'SPV') {
    const fos = await prisma.user.findMany({
      where: { role: 'FO', area: { is: session.areaId ? { id: session.areaId } : undefined } },
      include: { afa: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })
    spvFoData = await Promise.all(
      fos.map(async (fo) => ({
        fo: { id: fo.id, name: fo.name, afa: fo.afa },
        stocks: await getStockBalance(fo.id),
      }))
    )
  }

  // Collect all products that appear in FO stocks (for table columns)
  const allProducts = Array.from(
    new Map(
      [...foStockData, ...spvFoData]
        .flatMap(d => d.stocks.map(s => s.product))
        .map(p => [p.id, p])
    ).values()
  )

  const foRows = session.role === 'AFA' ? foStockData : spvFoData

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>📦 Saldo Stok Saat Ini</h2>
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

      {/* My stock cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {myStocks.map((stock) => (
          <div key={stock.product.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {stock.product.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
              <span style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: 'var(--primary)' }}>
                {stock.quantity.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {stock.product.unit}
              </span>
            </div>
          </div>
        ))}
        {myStocks.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem' }}>
            <p>Saldo stok Anda saat ini kosong.</p>
          </div>
        )}
      </div>

      {/* FO Monitoring Table (AFA & SPV only) */}
      {['SPV', 'AFA'].includes(session.role) && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>👀 Pantauan Stok FO</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '0.2rem 0.65rem', borderRadius: '9999px', border: '1px solid var(--border)' }}>
              {foRows.length} FO
            </span>
          </div>

          {foRows.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p>Belum ada FO yang terdaftar di bawah Anda.</p>
            </div>
          ) : allProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p>FO di bawah Anda belum memiliki stok yang tercatat.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Nama FO</th>
                      {session.role === 'SPV' && <th style={{ ...thStyle, textAlign: 'left' }}>AFA</th>}
                      {allProducts.map(p => (
                        <th key={p.id} style={{ ...thStyle, textAlign: 'right' }}>
                          {p.name}
                          <span style={{ display: 'block', fontWeight: 400, textTransform: 'lowercase', letterSpacing: 0 }}>({p.unit})</span>
                        </th>
                      ))}
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foRows.map(({ fo, stocks }) => {
                      const totalQty = stocks.reduce((sum, s) => sum + s.quantity, 0)
                      return (
                        <tr key={fo.id} style={{ transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{fo.name}</td>
                          {session.role === 'SPV' && (
                            <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {(fo as any).afa?.name || '-'}
                            </td>
                          )}
                          {allProducts.map(p => {
                            const s = stocks.find(st => st.product.id === p.id)
                            const qty = s?.quantity ?? 0
                            return (
                              <td key={p.id} style={{ ...tdStyle, textAlign: 'right', fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {qty > 0 ? qty.toLocaleString() : '—'}
                              </td>
                            )
                          })}
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                            <span style={{ background: totalQty > 0 ? 'var(--primary-light)' : 'var(--surface-2)', color: totalQty > 0 ? 'var(--primary)' : 'var(--text-muted)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.82rem' }}>
                              {totalQty > 0 ? totalQty.toLocaleString() : '0'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
