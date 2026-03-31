import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import AfaStockRequestTable from '@/components/AfaStockRequestTable'

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
      where: { afaId: session.userId, role: { in: ['FO', 'INTERN'] } },
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
      where: { role: { in: ['FO', 'INTERN'] }, area: { is: session.areaId ? { id: session.areaId } : undefined } },
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

  // Fetch AFA Stock Requests (Pengajuan Stok AFA)
  let afaStockRequests: any[] = []
  if (session.role === 'AFA') {
    afaStockRequests = await prisma.request.findMany({
      where: { foId: session.userId, commodity: 'AFA_STOCK_IN' },
      include: { afa: true, details: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
  } else if (session.role === 'SPV') {
    afaStockRequests = await prisma.request.findMany({
      where: {
        commodity: 'AFA_STOCK_IN',
        fo: { area: { is: session.areaId ? { id: session.areaId } : undefined } }
      },
      include: { fo: true, afa: true, details: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
  }

  // ──────────────────────────────────────────────
  // Fetch FO→AFA stock requests (permintaan stok)
  // ──────────────────────────────────────────────
  let foStockRequests: any[] = []
  const stockReqInclude = { fo: true, afa: true, farmer: true, details: { include: { product: true } }, demoPlots: { select: { id: true, isFinalSession: true } } }

  if (session.role === 'FO' || session.role === 'INTERN') {
    foStockRequests = await prisma.request.findMany({
      where: { foId: session.userId, OR: [{ commodity: '-' }, { farmerId: null }] },
      include: stockReqInclude,
      orderBy: { createdAt: 'desc' }
    })
  } else if (session.role === 'AFA') {
    foStockRequests = await prisma.request.findMany({
      where: { afaId: session.userId, OR: [{ commodity: '-' }, { farmerId: null }] },
      include: stockReqInclude,
      orderBy: { createdAt: 'desc' }
    })
  } else if (session.role === 'SPV' || session.role === 'ADMIN') {
    foStockRequests = await prisma.request.findMany({
      where: { OR: [{ commodity: '-' }, { farmerId: null }] },
      include: stockReqInclude,
      orderBy: { createdAt: 'desc' }
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':        return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED':         return <span className="badge badge-success">Disetujui</span>
      case 'REJECTED':         return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI':return <span className="badge badge-neutral">Selesai</span>
      default:                 return <span className="badge badge-neutral">{status}</span>
    }
  }

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

  return (
    <div>
      {session.role !== 'SPV' && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>📦 Saldo Stok Saat Ini</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {session.role === 'AFA' && (
                <Link href="/dashboard/stock/in">
                  <button className="btn btn-primary">➕ Pengajuan Stok</button>
                </Link>
              )}
              {(session.role === 'FO' || session.role === 'INTERN') && (
                <Link href="/dashboard/demoplot/request">
                  <button className="btn btn-primary">📦 Minta Stok dari AFA</button>
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
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem', marginBottom: '1.5rem' }}>
                <p>Saldo stok Anda saat ini kosong.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* FO→AFA Stock Requests (Permintaan Stok) — ALL ROLES     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {foStockRequests.length > 0 && (
        <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📦 {session.role === 'FO' || session.role === 'INTERN' ? 'Permintaan Stok Saya' : 'Permintaan Stok FO'}
            {foStockRequests.filter((r: any) => r.status === 'SUBMITTED').length > 0 && (
              <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                {foStockRequests.filter((r: any) => r.status === 'SUBMITTED').length} baru
              </span>
            )}
          </h3>
          <div className="table-card">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tanggal</th>
                    {!['FO','INTERN'].includes(session.role) && <th>FO Pengaju</th>}
                    <th>Catatan</th>
                    <th>Produk Diminta</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {foStockRequests.map((req: any) => (
                    <tr key={req.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                      {!['FO','INTERN'].includes(session.role) && <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{req.fo?.name}</td>}
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 200 }}>{req.plan !== '-' ? req.plan : '-'}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {req.details?.map((d: any) => `${d.product?.name}: ${d.qtyRequested} ${d.product?.unit}`).join(', ')}
                      </td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>
                        <div className="action-row">
                          {req.status === 'SUBMITTED' && session.role === 'AFA' && (
                            <Link href={`/dashboard/demoplot/approve/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Approve Stok</button>
                            </Link>
                          )}
                          {req.status === 'APPROVED' && req.demoPlots?.length > 0 && (req.foId === session.userId || req.afaId === session.userId) && (
                            <Link href={`/dashboard/demoplot/continue/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>▶ Lanjutkan Sesi</button>
                            </Link>
                          )}
                          <Link href={`/dashboard/demoplot/detail/${req.id}`}>
                            <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Detail</button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AFA Stock Requests Section (SPV & AFA only) */}
      {['SPV', 'AFA'].includes(session.role) && (
        <AfaStockRequestTable requests={afaStockRequests} role={session.role} />
      )}

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
                        <tr key={fo.id} className="fo-stock-row">
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
