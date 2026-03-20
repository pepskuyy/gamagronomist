import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getSubordinateUsers, getKpiDataForFieldUser } from '@/app/actions/kpi'
import KpiSection from '@/components/KpiSection'
import KpiFieldDashboard from '@/components/KpiFieldDashboard'
import DemoPlotMap from '@/components/DemoPlotMap'

const prisma = new PrismaClient()

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  // ----- KPI QUERIES -----
  const isSPV = session.role === 'SPV' || session.role === 'ADMIN'
  const isAFA = session.role === 'AFA'
  
  // Build filter based on role
  const requestFilter: any = {}
  if (session.role === 'FO') requestFilter.foId = session.userId
  else if (session.role === 'AFA') requestFilter.afaId = session.userId

  const [
    totalRequests,
    approvedRequests,
    pendingRequests,
    completedDemoPlots,
    recentLedgers,
    recentRequests
  ] = await Promise.all([
    prisma.request.count({ where: requestFilter }),
    prisma.request.count({ where: { ...requestFilter, status: 'APPROVED' } }),
    prisma.request.count({ where: { ...requestFilter, status: 'SUBMITTED' } }),
    prisma.request.count({ where: { ...requestFilter, status: 'DEMO_PLOT_SELESAI' } }),
    prisma.ledger.findMany({
      where: isSPV ? {} : { userId: session.userId },
      include: { product: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.request.findMany({
      where: requestFilter,
      include: { fo: true, farmer: true, details: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ])

  // ----- KPI DATA (for SPV / ADMIN) -----
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  
  let subordinates: { id: string; username: string; name: string; role: string }[] = []
  if (isSPV) {
    subordinates = await getSubordinateUsers()
  }

  // ----- KPI DATA (for AFA / FO) — shows target set by SPV -----
  let fieldKpi: Awaited<ReturnType<typeof getKpiDataForFieldUser>> | null = null
  if (session.role === 'AFA' || session.role === 'FO') {
    fieldKpi = await getKpiDataForFieldUser(session.userId, session.role, currentMonth, currentYear)
  }

  // Stock summary for all users visible to this role
  let stockSummary: { userName: string, role: string, productName: string, unit: string, balance: number }[] = []
  if (isSPV || isAFA) {
    const userFilter: any = {}
    if (isAFA) {
      // AFA sees own stock + FOs under them
      userFilter.OR = [
        { id: session.userId },
        { afaId: session.userId }
      ]
    }
    
    const users = await prisma.user.findMany({
      where: Object.keys(userFilter).length ? userFilter : { role: { in: ['AFA', 'FO'] } },
      select: { id: true, name: true, role: true }
    })

    for (const user of users) {
      const ledgers = await prisma.ledger.groupBy({
        by: ['productId'],
        where: { userId: user.id },
        _sum: { quantity: true }
      })
      for (const l of ledgers) {
        if ((l._sum.quantity || 0) !== 0) {
          const product = await prisma.product.findUnique({ where: { id: l.productId } })
          if (product) {
            stockSummary.push({
              userName: user.name,
              role: user.role,
              productName: product.name,
              unit: product.unit,
              balance: l._sum.quantity || 0
            })
          }
        }
      }
    }
  }

  const formatType = (type: string) => {
    const map: Record<string, { label: string, cls: string }> = {
      'STOCK_IN_GUDANG': { label: 'Stok Masuk', cls: 'badge-success' },
      'TRANSFER_TO_FO': { label: 'Transfer ke FO', cls: 'badge-warning' },
      'RECEIVE_FROM_AFA': { label: 'Terima AFA', cls: 'badge-success' },
      'USAGE_DEMOPLOT': { label: 'Pemakaian', cls: 'badge-danger' },
      'DIRECT_USAGE_AFA': { label: 'Pakai Langsung', cls: 'badge-danger' },
      'ADJUSTMENT_PLUS': { label: 'Adj (+)', cls: 'badge-success' },
      'ADJUSTMENT_MINUS': { label: 'Adj (-)', cls: 'badge-danger' },
    }
    const m = map[type] || { label: type, cls: 'badge-neutral' }
    return <span className={`badge ${m.cls}`}>{m.label}</span>
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'SUBMITTED': return <span className="badge badge-warning">Pending</span>
      case 'APPROVED': return <span className="badge badge-success">Approved</span>
      case 'REJECTED': return <span className="badge badge-danger">Rejected</span>
      case 'DEMO_PLOT_SELESAI': return <span className="badge badge-neutral">Selesai</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Selamat Datang, {session?.name}!</h1>
      <p style={{ marginBottom: '2rem' }}>Anda login sebagai <strong>{session?.role}</strong>. Berikut ringkasan operasional terbaru.</p>

      {/* SPV KPI Section */}
      {isSPV && (
        <KpiSection
          ownerUserId={session.userId}
          subordinates={subordinates}
        />
      )}

      {/* AFA / FO KPI Section — full card layout, read-only */}
      {(session.role === 'AFA' || session.role === 'FO') && (
        <div className="card" style={{ marginBottom: '2.5rem' }}>
          <KpiFieldDashboard
            userId={session.userId}
            role={session.role}
            initialMonth={currentMonth}
            initialYear={currentYear}
          />
        </div>
      )}
      
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pending Approval</p>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{pendingRequests}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Request</p>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{totalRequests}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Approved</p>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{approvedRequests}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Demo Plot Selesai</p>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--secondary)' }}>{completedDemoPlots}</div>
        </div>
      </div>

      {/* Demo Plot Map Section */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <DemoPlotMap />
      </div>

      {/* Stock Summary Table (SPV/AFA only) */}
      {(isSPV || isAFA) && stockSummary.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>📦 Saldo Stok Per User</h2>
          <div className="table-card">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Produk</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{s.userName}</td>
                      <td><span className={`badge ${s.role === 'AFA' ? 'badge-success' : 'badge-neutral'}`}>{s.role}</span></td>
                      <td>{s.productName}</td>
                      <td style={{ fontWeight: 700, color: s.balance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {s.balance} {s.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Requests */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>🌾 Request Terbaru</h2>
        <div className="table-card">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>FO</th>
                  <th>Petani</th>
                  <th>Produk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map(req => (
                  <tr key={req.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}
                    </td>
                    <td>{req.fo?.name}</td>
                    <td>{req.farmer?.name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {req.details.map(d => d.product.name).join(', ')}
                    </td>
                    <td>{getStatusBadge(req.status)}</td>
                  </tr>
                ))}
                {recentRequests.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada request.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Ledger Activity */}
      <div>
        <h2 style={{ marginBottom: '1rem' }}>🕒 Aktivitas Stok Terbaru</h2>
        <div className="table-card">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  {isSPV && <th>User</th>}
                  <th>Tipe</th>
                  <th>Produk</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {recentLedgers.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(l.createdAt)}
                    </td>
                    {isSPV && <td style={{ fontWeight: 500 }}>{l.user.name}</td>}
                    <td>{formatType(l.transactionType)}</td>
                    <td>{l.product.name}</td>
                    <td style={{ fontWeight: 700, color: l.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {l.quantity > 0 ? '+' : ''}{l.quantity} {l.product.unit}
                    </td>
                  </tr>
                ))}
                {recentLedgers.length === 0 && (
                  <tr><td colSpan={isSPV ? 5 : 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transaksi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
