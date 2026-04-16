import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import AfaStockRequestTable from '@/components/AfaStockRequestTable'
import TeamStockTable from '@/components/TeamStockTable'
import TableFilter from '@/components/TableFilter'
import TablePager from '@/components/TablePager'

const prisma = new PrismaClient()

export default async function StockDashboardPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const resolvedParams = await props.searchParams
  const take = 20

  const pu = Math.max(1, parseInt(resolvedParams.pu || '1'))
  const pa = Math.max(1, parseInt(resolvedParams.pa || '1'))
  const pf = Math.max(1, parseInt(resolvedParams.pf || '1'))

  const qu = resolvedParams.qu?.trim()
  const qa = resolvedParams.qa?.trim()
  const start_a = resolvedParams.start_a ? new Date(resolvedParams.start_a) : undefined
  const end_a = resolvedParams.end_a ? new Date(`${resolvedParams.end_a}T23:59:59.999Z`) : undefined
  
  const qf = resolvedParams.qf?.trim()
  const start_f = resolvedParams.start_f ? new Date(resolvedParams.start_f) : undefined
  const end_f = resolvedParams.end_f ? new Date(`${resolvedParams.end_f}T23:59:59.999Z`) : undefined

  // 1. Fetch My Stocks
  const myStocks = await getStockBalance(session.userId)

  // 2. Fetch Team Users (Pantauan Stok)
  let teamUsers: { id: string; name: string; role: string; parentName?: string }[] = []
  let hasMoreUsers = false

  if (['ADMIN', 'SPV', 'AFA'].includes(session.role)) {
    const userWhere: any = { 
      role: { in: ['AFA', 'FO', 'INTERN'] },
      isActive: true,
      ...(qu ? { name: { contains: qu, mode: 'insensitive' } } : {})
    }
    
    if (session.role === 'SPV' && session.areaId) {
      userWhere.areaId = session.areaId
    } else if (session.role === 'AFA') {
      userWhere.afaId = session.userId
    }

    const totalUsers = await prisma.user.count({ where: userWhere })
    const users = await prisma.user.findMany({
      where: userWhere,
      include: { afa: { select: { name: true } }, area: { select: { name: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      skip: (pu - 1) * take,
      take
    })
    
    hasMoreUsers = (pu * take) < totalUsers

    teamUsers = users.map(u => ({
      id: u.id, name: u.name, role: u.role, 
      parentName: u.role === 'AFA' ? (u.area?.name || 'Pusat') : (u.afa?.name || u.area?.name || '-')
    }))
  }

  const stocksMap: Record<string, { product: any, quantity: number }[]> = {}
  await Promise.all(
    teamUsers.map(async (u) => {
      stocksMap[u.id] = await getStockBalance(u.id)
    })
  )

  const allProducts = await prisma.product.findMany({ orderBy: { name: 'asc' } })

  // 3. Fetch AFA Stock Requests
  let afaStockRequests: any[] = []
  let hasMoreAfaReqs = false

  if (['SPV', 'AFA', 'FAM', 'WHM'].includes(session.role)) {
    let afaStockWhere: any = { commodity: 'AFA_STOCK_IN' }
    
    if (session.role === 'AFA') {
      afaStockWhere.foId = session.userId
    } else if (session.role === 'SPV' && session.areaId) {
      afaStockWhere.fo = { areaId: session.areaId }
    }
    // FAM and WHM see all AFA_STOCK_IN requests (global scope)

    if (qa) {
      // `fo` points to the requester (AFA) in AFA_STOCK_IN
      afaStockWhere.fo = { ...afaStockWhere.fo, name: { contains: qa, mode: 'insensitive' } }
    }
    if (start_a || end_a) {
      afaStockWhere.createdAt = {}
      if (start_a) afaStockWhere.createdAt.gte = start_a
      if (end_a) afaStockWhere.createdAt.lte = end_a
    }

    const totalAfaReq = await prisma.request.count({ where: afaStockWhere })
    afaStockRequests = await prisma.request.findMany({
      where: afaStockWhere,
      include: { fo: true, afa: true, details: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pa - 1) * take,
      take
    })
    hasMoreAfaReqs = (pa * take) < totalAfaReq
  }

  // 4. Fetch FO Stock Requests
  let foStockRequests: any[] = []
  let hasMoreFoReqs = false

  let foStockWhere: any = { OR: [{ commodity: '-' }, { farmerId: null }] }
  if (['FO', 'INTERN'].includes(session.role)) {
    foStockWhere.foId = session.userId
  } else if (session.role === 'AFA') {
    foStockWhere.afaId = session.userId
  }

  if (qf) {
    foStockWhere.fo = { name: { contains: qf, mode: 'insensitive' } }
  }
  if (start_f || end_f) {
    foStockWhere.createdAt = {}
    if (start_f) foStockWhere.createdAt.gte = start_f
    if (end_f) foStockWhere.createdAt.lte = end_f
  }

  const stockReqInclude = { fo: true, afa: true, farmer: true, details: { include: { product: true } }, demoPlots: { select: { id: true, isFinalSession: true } } }
  
  const totalFoReq = await prisma.request.count({ where: foStockWhere })
  foStockRequests = await prisma.request.findMany({
    where: foStockWhere,
    include: stockReqInclude,
    orderBy: { createdAt: 'desc' },
    skip: (pf - 1) * take,
    take
  })
  hasMoreFoReqs = (pf * take) < totalFoReq

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':        return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED':         return <span className="badge badge-success">Disetujui</span>
      case 'REJECTED':         return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI':return <span className="badge badge-neutral">Selesai</span>
      default:                 return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      {/* 1. KARTU STOK PRIBADI (Tidak terlihat untuk Admin/SPV) */}
      {!['FAM', 'WHM'].includes(session.role) && session.role !== 'SPV' && session.role !== 'ADMIN' && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>📦 Saldo Stok Saat Ini</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {session.role === 'AFA' && (
                <Link href="/dashboard/stock/in">
                  <button className="btn btn-primary">➕ Pengajuan Stok</button>
                </Link>
              )}
              {['FO', 'INTERN'].includes(session.role) && (
                <Link href="/dashboard/demoplot/request">
                  <button className="btn btn-primary">📦 Minta Stok dari AFA</button>
                </Link>
              )}
              <Link href="/dashboard/stock/history">
                <button className="btn btn-outline">🕒 Histori Ledger</button>
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {myStocks.map((stock) => {
              const product = stock.product as any
              const hasGramasi = product.unitGramasi && product.gramasiPerUnit
              const displayUnit = product.unitGramasi || product.unit
              const kemasanEquiv = hasGramasi ? (stock.quantity / product.gramasiPerUnit) : null

              return (
                <div key={product.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    {product.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
                    <span style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: 'var(--primary)' }}>
                      {stock.quantity.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      {displayUnit}
                    </span>
                  </div>
                  {kemasanEquiv != null && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      ≈ {Number.isInteger(kemasanEquiv) ? kemasanEquiv : kemasanEquiv.toFixed(1)} {product.unit}
                    </div>
                  )}
                </div>
              )
            })}
            {myStocks.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem' }}>
                <p>Saldo stok Anda saat ini kosong.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SPV GUDANG SAMPEL QUICK ACTION */}
      {['SPV', 'ADMIN'].includes(session.role) && (
        <div style={{ marginBottom: '3rem', padding: '1.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
             <div>
               <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>🧪 Gudang Sampel SPV</h2>
               <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Kelola stok sampel mandiri yang dipisahkan dari persediaan Accurate.</p>
             </div>
             <Link href="/dashboard/stock/sample">
               <button className="btn btn-primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>Buka Gudang Sampel →</button>
             </Link>
          </div>
        </div>
      )}

      {/* 3. PANTAUAN STOK USER */}
      {['ADMIN', 'SPV', 'AFA'].includes(session.role) && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>👀 Pantauan Stok User</h2>
            </div>
          </div>
          <TableFilter prefix="u" showDateRange={false} />

          {teamUsers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p>Belum ada user yang terdaftar untuk dipantau, atau tidak ada kecocokan pencarian.</p>
            </div>
          ) : (
            <>
              <TeamStockTable 
                users={teamUsers}
                stocks={stocksMap}
                allProducts={allProducts}
                role={session.role}
              />
              <TablePager prefix="u" currentPage={pu} hasMore={hasMoreUsers} />
            </>
          )}
        </div>
      )}

      {/* 3. PENGAJUAN STOK AFA */}
      {['SPV', 'AFA', 'FAM', 'WHM'].includes(session.role) && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>📨 Pengajuan Stok {session.role === 'AFA' ? 'Saya' : session.role === 'SPV' ? 'dari AFA' : `(${session.role === 'FAM' ? 'FA Manager' : 'WH Manager'})`}</h2>
          </div>
          <TableFilter prefix="a" showDateRange={true} />

          {afaStockRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Belum ada pengajuan stok.</p>
            </div>
          ) : (
            <>
              <AfaStockRequestTable requests={afaStockRequests} role={session.role} />
              <TablePager prefix="a" currentPage={pa} hasMore={hasMoreAfaReqs} />
            </>
          )}
        </div>
      )}

      {/* 4. PERMINTAAN STOK FO (hidden for FAM/WHM) */}
      {!['FAM', 'WHM'].includes(session.role) && (
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📦 {['FO', 'INTERN'].includes(session.role) ? 'Permintaan Stok Saya' : 'Permintaan Stok FO'}
          {foStockRequests.filter((r: any) => r.status === 'SUBMITTED').length > 0 && (
            <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              {foStockRequests.filter((r: any) => r.status === 'SUBMITTED').length} baru
            </span>
          )}
        </h2>
        <TableFilter prefix="f" showDateRange={true} />

        {foStockRequests.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Belum ada riwayat permintaan stok.</p>
          </div>
        ) : (
          <div className="table-card" style={{ display: 'block' }}>
            <div className="table-responsive">
              <table style={{ minWidth: 600, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Tanggal</th>
                    {!['FO','INTERN'].includes(session.role) && (
                      <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>FO Pengaju</th>
                    )}
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Catatan</th>
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Produk Diminta</th>
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {foStockRequests.map((req: any) => (
                    <tr key={req.id}>
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                      {!['FO','INTERN'].includes(session.role) && (
                        <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600 }}>{req.fo?.name}</td>
                      )}
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 200 }}>{req.plan !== '-' ? req.plan : '-'}</td>
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                        {req.details?.map((d: any) => {
                          const unit = d.requestUnit || d.product?.unitGramasi || d.product?.unit
                          const qty = d.qtyApproved != null ? `${d.qtyApproved} ${unit} (diminta: ${d.qtyRequested})` : `${d.qtyRequested} ${unit}`
                          return `${d.product?.name}: ${qty}`
                        }).join(', ')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>{getStatusBadge(req.status)}</td>
                      <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                        <div className="action-row" style={{ justifyContent: 'center' }}>
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
            <TablePager prefix="f" currentPage={pf} hasMore={hasMoreFoReqs} />
          </div>
        )}
      </div>
      )}

    </div>
  )
}
