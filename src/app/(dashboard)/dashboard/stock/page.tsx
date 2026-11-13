import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'
import Link from 'next/link'
import AfaStockRequestTable from '@/components/AfaStockRequestTable'
import TeamStockTable from '@/components/TeamStockTable'
import TableFilter from '@/components/TableFilter'
import TablePager from '@/components/TablePager'
import { AdminResetButton } from '@/components/AdminResetButton'
import StockTransferPanel from '@/components/StockTransferPanel'
import { Plus, Package, History, Play, ArrowRight } from 'lucide-react'


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

  // Build query conditions first (needed before parallel fetch)
  const isTeamViewer = ['ADMIN', 'SPV', 'AFA', 'PLANTATION'].includes(session.role)
  const isAfaStockViewer = ['ADMIN', 'SPV', 'AFA', 'PLANTATION', 'FAM', 'WHM', 'BD'].includes(session.role)

  const userWhere: any = {
    role: { in: ['AFA', 'PLANTATION', 'FO', 'INTERN'] },
    isActive: true,
    ...(qu ? { name: { contains: qu, mode: 'insensitive' } } : {})
  }
  if (session.role === 'SPV' && session.areaId) {
    userWhere.areaId = session.areaId
  } else if (['AFA', 'PLANTATION'].includes(session.role)) {
    userWhere.afaId = session.userId
  }

  let afaStockWhere: any = { commodity: 'AFA_STOCK_IN' }
  if (['AFA', 'PLANTATION', 'BD'].includes(session.role)) {
    afaStockWhere.foId = session.userId
  } else if (session.role === 'SPV' && session.areaId) {
    afaStockWhere.fo = { areaId: session.areaId }
  }
  if (qa) {
    afaStockWhere.fo = { ...afaStockWhere.fo, name: { contains: qa, mode: 'insensitive' } }
  }
  if (start_a || end_a) {
    afaStockWhere.createdAt = {}
    if (start_a) afaStockWhere.createdAt.gte = start_a
    if (end_a) afaStockWhere.createdAt.lte = end_a
  }

  // Restock AFA (jumlah dalam kemasan) punya tabel sendiri; di tabel FO angkanya terbaca sebagai ml/gr
  let foStockWhere: any = { commodity: { not: 'AFA_STOCK_IN' }, OR: [{ commodity: '-' }, { farmerId: null }] }
  if (['FO', 'INTERN'].includes(session.role)) {
    foStockWhere.foId = session.userId
  } else if (['AFA', 'PLANTATION'].includes(session.role)) {
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

  // ── Jalankan SEMUA query dalam satu Promise.all paralel ──
  const [
    myStocks,
    allProducts,
    totalUsers,
    rawUsers,
    totalAfaReq,
    rawAfaRequests,
    totalFoReq,
    rawFoRequests,
  ] = await Promise.all([
    // 1. Stok saya
    getStockBalance(session.userId),
    // 2. Daftar semua produk master
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    // 3. Hitung total users tim
    isTeamViewer ? prisma.user.count({ where: userWhere }) : Promise.resolve(0),
    // 4. Daftar users tim (dengan pagination)
    isTeamViewer
      ? prisma.user.findMany({
          where: userWhere,
          include: { afa: { select: { name: true } }, area: { select: { name: true } } },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
          skip: (pu - 1) * take,
          take
        })
      : Promise.resolve([]),
    // 5. Hitung total AFA stock requests
    isAfaStockViewer ? prisma.request.count({ where: afaStockWhere }) : Promise.resolve(0),
    // 6. Daftar AFA stock requests (dengan pagination)
    isAfaStockViewer
      ? prisma.request.findMany({
          where: afaStockWhere,
          include: { fo: true, afa: true, details: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (pa - 1) * take,
          take
        })
      : Promise.resolve([]),
    // 7. Hitung total FO stock requests
    prisma.request.count({ where: foStockWhere }),
    // 8. Daftar FO stock requests (dengan pagination)
    prisma.request.findMany({
      where: foStockWhere,
      include: stockReqInclude,
      orderBy: { createdAt: 'desc' },
      skip: (pf - 1) * take,
      take
    }),
  ])

  // ── Resolve team variables ──
  let teamUsers: { id: string; name: string; role: string; parentName?: string }[] = []
  let hasMoreUsers = false
  if (isTeamViewer) {
    hasMoreUsers = (pu * take) < totalUsers
    teamUsers = (rawUsers as any[]).map((u: any) => ({
      id: u.id, name: u.name, role: u.role,
      parentName: ['AFA', 'PLANTATION'].includes(u.role) ? (u.area?.name || 'Pusat') : (u.afa?.name || u.area?.name || '-')
    }))
  }

  // Tujuan "Pindah ke akun lain" di modal penyesuaian: semua akun pemegang stok yang aktif
  const transferTargets = ['ADMIN', 'SPV'].includes(session.role)
    ? await prisma.user.findMany({
        where: { isActive: true, role: { in: ['AFA', 'FO', 'INTERN', 'PLANTATION', 'BD'] } },
        select: { id: true, name: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      })
    : []

  // ── Transfer stok antar AFA (pengajuan → approval SPV → konfirmasi penerima) ──
  const isTransferViewer = ['ADMIN', 'SPV', 'AFA', 'PLANTATION'].includes(session.role)
  const transferWhere: any = session.role === 'ADMIN' ? {}
    : session.role === 'SPV' ? (session.areaId ? { fromUser: { areaId: session.areaId } } : {})
    : { OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] }
  const unitSelect = { name: true, unit: true, unitGramasi: true, gramasiPerUnit: true }
  const [rawTransfers, transferReceivers] = isTransferViewer
    ? await Promise.all([
        prisma.stockTransfer.findMany({
          where: transferWhere,
          include: {
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
            items: { select: { id: true, qtyRequested: true, qtyApproved: true, product: { select: unitSelect } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['AFA', 'PLANTATION'] }, id: { not: session.userId } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], []]
  const stockTransfers = rawTransfers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))

  // ── Stok tim: jalankan setelah list user diketahui (tetap paralel antar user) ──
  const stocksMap: Record<string, { product: any, quantity: number }[]> = {}
  await Promise.all(
    teamUsers.map(async (u) => {
      stocksMap[u.id] = await getStockBalance(u.id, {
        includeNegative: ['ADMIN', 'SPV'].includes(session.role),
      })
    })
  )

  // ── AFA & FO requests ──
  const afaStockRequests: any[] = isAfaStockViewer ? rawAfaRequests as any[] : []
  const hasMoreAfaReqs = isAfaStockViewer ? (pa * take) < totalAfaReq : false
  const foStockRequests: any[] = rawFoRequests as any[]
  const hasMoreFoReqs = (pf * take) < totalFoReq

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
            <h2 style={{ margin: 0 }}>Saldo Stok Saat Ini</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['AFA', 'PLANTATION'].includes(session.role) && (
                <Link href="/dashboard/stock/in">
                  <button className="btn btn-primary"><Plus size={16} strokeWidth={1.75} className="icon-inline" />Pengajuan Stok</button>
                </Link>
              )}
              {session.role === 'BD' && (
                <Link href="/dashboard/stock/bd-request">
                  <button className="btn btn-primary"><Plus size={16} strokeWidth={1.75} className="icon-inline" />Pengajuan Stok Sampel</button>
                </Link>
              )}
              {['FO', 'INTERN'].includes(session.role) && (
                <Link href="/dashboard/demoplot/request">
                  <button className="btn btn-primary"><Package size={16} strokeWidth={1.75} className="icon-inline" />Minta Stok dari AFA</button>
                </Link>
              )}
              <Link href="/dashboard/stock/history">
                <button className="btn btn-outline"><History size={16} strokeWidth={1.75} className="icon-inline" />Histori Ledger</button>
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {myStocks.map((stock) => {
              const product = stock.product as any
              const hasGramasi   = product.unitGramasi && product.gramasiPerUnit && product.gramasiPerUnit > 0
              
              // Primary is what's actually stored in ledger (ml/gr if available, otherwise PCS)
              const primaryQty   = stock.quantity
              const primaryUnit  = hasGramasi ? product.unitGramasi : product.unit
              
              // Secondary is the converted kemasan (PCS/Btl)
              const secondaryQty = hasGramasi ? +(stock.quantity / product.gramasiPerUnit).toFixed(2) : null
              const secondaryUnit = product.unit

              return (
                <div key={product.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {product.name}
                    {hasGramasi && <span className="num" style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({product.gramasiPerUnit}{product.unitGramasi}/{product.unit})</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span className="num" style={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1, color: 'var(--text-main)' }}>
                      {primaryQty.toLocaleString()}
                    </span>
                    <span className="unit" style={{ fontSize: '0.875rem' }}>
                      {primaryUnit}
                    </span>
                  </div>
                  {secondaryQty != null && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      = <span className="num">{Number.isInteger(secondaryQty) ? secondaryQty : secondaryQty.toFixed(1)}</span><span className="unit">{secondaryUnit}</span> total
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
               <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Gudang Sampel SPV</h2>
               <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Kelola stok sampel mandiri yang dipisahkan dari persediaan Accurate.</p>
             </div>
             <Link href="/dashboard/stock/sample">
               <button className="btn btn-primary">Buka Gudang Sampel<ArrowRight size={16} strokeWidth={1.75} className="icon-inline" /></button>
             </Link>
          </div>
        </div>
      )}

      {/* 3. PANTAUAN STOK USER */}
      {['ADMIN', 'SPV', 'AFA', 'PLANTATION'].includes(session.role) && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>Pantauan Stok User</h2>
            </div>
            {/* ADMIN/SPV tidak punya kartu stok pribadi (tempat tombol ini untuk role lain) */}
            {['ADMIN', 'SPV'].includes(session.role) && (
              <Link href="/dashboard/stock/history">
                <button className="btn btn-outline"><History size={16} strokeWidth={1.75} className="icon-inline" />Histori Ledger</button>
              </Link>
            )}
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
                transferTargets={transferTargets}
              />
              <TablePager prefix="u" currentPage={pu} hasMore={hasMoreUsers} />
            </>
          )}
        </div>
      )}

      {/* 3. PENGAJUAN STOK AFA / BD */}
      {isAfaStockViewer && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Pengajuan Stok {['AFA', 'PLANTATION', 'BD'].includes(session.role) ? 'Saya' : session.role === 'SPV' ? 'dari Tim' : session.role === 'ADMIN' ? 'AFA' : `(${session.role === 'FAM' ? 'FA Manager' : 'WH Manager'})`}</h2>
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

      {/* 3b. TRANSFER STOK ANTAR AFA */}
      {isTransferViewer && (
        <StockTransferPanel
          role={session.role}
          meId={session.userId}
          transfers={stockTransfers}
          targets={transferReceivers}
          balances={myStocks.map(s => ({ productId: s.product.id, quantity: s.quantity, product: s.product }))}
        />
      )}

      {/* 4. PERMINTAAN STOK FO (hidden for FAM/WHM) */}
      {!['FAM', 'WHM'].includes(session.role) && (
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {['FO', 'INTERN'].includes(session.role) ? 'Permintaan Stok Saya' : 'Permintaan Stok FO'}
          {foStockRequests.filter((r: any) => r.status === 'SUBMITTED').length > 0 && (
            <span className="num" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)' }}>
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
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Tanggal</th>
                    {!['FO','INTERN'].includes(session.role) && (
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>FO Pengaju</th>
                    )}
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Catatan</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>Produk Diminta</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {foStockRequests.map((req: any) => (
                    <tr key={req.id}>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', fontFamily: 'var(--font-mono-stack)', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                      {!['FO','INTERN'].includes(session.role) && (
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-main)', fontWeight: 500 }}>{req.fo?.name}</td>
                      )}
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 200 }}>{req.plan !== '-' ? req.plan : '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.82rem' }}>
                        {req.details?.map((d: any) => {
                          const qty = d.qtyApproved != null ? d.qtyApproved : d.qtyRequested
                          const hasGramasi = d.product?.gramasiPerUnit && d.product?.unitGramasi
                          // FO→AFA: qty disimpan dalam gramasi (ml/gr), tampilkan langsung
                          // Konversi balik ke kemasan hanya untuk info tambahan
                          let label: string
                          if (hasGramasi) {
                            const unitGramasi = d.product.unitGramasi
                            const kemasanQty = +(qty / d.product.gramasiPerUnit).toFixed(2)
                            const kemasanStr = Number.isInteger(kemasanQty) ? kemasanQty.toString() : kemasanQty.toString()
                            label = `${d.product?.name}: ${qty.toLocaleString('id-ID')} ${unitGramasi} (${kemasanStr} ${d.product?.unit})`
                          } else {
                            // Produk tanpa gramasi: qty = kemasan
                            label = `${d.product?.name}: ${qty.toLocaleString('id-ID')} ${d.product?.unit || 'PCS'}`
                          }
                          if (d.qtyApproved != null && d.qtyApproved !== d.qtyRequested) {
                            label += ` [diminta: ${d.qtyRequested}]`
                          }
                          return label
                        }).join(', ')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>{getStatusBadge(req.status)}</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                        <div className="action-row" style={{ justifyContent: 'center' }}>
                          {req.status === 'SUBMITTED' && ['AFA', 'PLANTATION'].includes(session.role) && (
                            <Link href={`/dashboard/demoplot/approve/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>Approve Stok</button>
                            </Link>
                          )}
                          {req.status === 'APPROVED' && req.demoPlots?.length > 0 && (req.foId === session.userId || req.afaId === session.userId) && (
                            <Link href={`/dashboard/demoplot/continue/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}><Play size={14} strokeWidth={1.75} className="icon-inline" />Lanjutkan Sesi</button>
                            </Link>
                          )}
                          {session.role === 'ADMIN' && ['APPROVED_SPV', 'APPROVED_FAM', 'APPROVED_WHM', 'APPROVED'].includes(req.status) && !req.accurateInvoiceNo && (
                            <AdminResetButton requestId={req.id} />
                          )}
                          <Link href={`/dashboard/demoplot/detail/${req.id}`}>
                            <button className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>Detail</button>
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
