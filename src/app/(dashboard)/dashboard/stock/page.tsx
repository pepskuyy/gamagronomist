import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import AfaStockRequestTable from '@/components/AfaStockRequestTable'
import TeamStockTable from '@/components/TeamStockTable'

const prisma = new PrismaClient()

export default async function StockDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const myStocks = await getStockBalance(session.userId)

  // Determine who to fetch for monitoring table
  let teamUsers: { id: string; name: string; role: string; parentName?: string }[] = []

  if (session.role === 'ADMIN') {
    // Admin sees ALL AFA and FO/INTERN
    const users = await prisma.user.findMany({
      where: { role: { in: ['AFA', 'FO', 'INTERN'] } },
      include: { afa: { select: { name: true } }, area: { select: { name: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    })
    teamUsers = users.map(u => ({
      id: u.id, name: u.name, role: u.role, 
      parentName: u.role === 'AFA' ? (u.area?.name || 'Pusat') : (u.afa?.name || u.area?.name || '-')
    }))
  } else if (session.role === 'SPV') {
    // SPV sees AFA and FO in their Area
    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['AFA', 'FO', 'INTERN'] },
        // If SPV has area, filter by area. Note: some logic depends on areaId directly.
        ...(session.areaId ? { areaId: session.areaId } : {})
      },
      include: { afa: { select: { name: true } }, area: { select: { name: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    })
    // For SPV, also include FOs that might be linked to AFAs in this area but don't have areaId explicitly (just in case)
    // Actually the above is safe.
    teamUsers = users.map(u => ({
      id: u.id, name: u.name, role: u.role, 
      parentName: u.role === 'AFA' ? (u.area?.name || '-') : (u.afa?.name || '-')
    }))
  } else if (session.role === 'AFA') {
    // AFA sees FOs under them
    const fos = await prisma.user.findMany({
      where: { afaId: session.userId, role: { in: ['FO', 'INTERN'] } },
      orderBy: { name: 'asc' },
    })
    teamUsers = fos.map(u => ({
      id: u.id, name: u.name, role: u.role
    }))
  }

  // Fetch stocks for all teamUsers
  const stocksMap: Record<string, { product: any, quantity: number }[]> = {}
  await Promise.all(
    teamUsers.map(async (u) => {
      stocksMap[u.id] = await getStockBalance(u.id)
    })
  )

  // Collect all products globally available to be columns
  const allProductsMap = new Map()
  
  // If there are no team users, we can just fetch all products in db
  if (teamUsers.length === 0) {
    const prods = await prisma.product.findMany()
    prods.forEach(p => allProductsMap.set(p.id, p))
  } else {
    // Collect from actual stocks
    for (const uid in stocksMap) {
      stocksMap[uid].forEach(s => allProductsMap.set(s.product.id, s.product))
    }
  }
  const allProducts = Array.from(allProductsMap.values())

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

      {/* Global Stock Monitoring Table (ADMIN, SPV, AFA only) */}
      {['ADMIN', 'SPV', 'AFA'].includes(session.role) && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>👀 Pantauan Stok User</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '0.2rem 0.65rem', borderRadius: '9999px', border: '1px solid var(--border)' }}>
              {teamUsers.length} User
            </span>
          </div>

          {teamUsers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p>Belum ada user yang terdaftar untuk dipantau.</p>
            </div>
          ) : allProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p>User yang dipantau belum memiliki stok yang tercatat.</p>
            </div>
          ) : (
            <TeamStockTable 
              users={teamUsers}
              stocks={stocksMap}
              allProducts={allProducts}
              role={session.role}
            />
          )}
        </div>
      )}
    </div>
  )
}

