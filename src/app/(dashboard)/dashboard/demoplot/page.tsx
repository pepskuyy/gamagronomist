import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function DemoPlotIndexPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return null

  const include = { fo: true, afa: true, farmer: true, details: { include: { product: true } }, demoPlots: { select: { id: true, isFinalSession: true } } }
  let requests: any[] = []
  if (session.role === 'FO' || session.role === 'INTERN') {
    requests = await prisma.request.findMany({ where: { foId: session.userId }, include, orderBy: { createdAt: 'desc' } })
  } else if (session.role === 'AFA') {
    requests = await prisma.request.findMany({ where: { OR: [{ afaId: session.userId }, { foId: session.userId }] }, include, orderBy: { createdAt: 'desc' } })
  } else {
    requests = await prisma.request.findMany({ include, orderBy: { createdAt: 'desc' } })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':        return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED':         return <span className="badge badge-success">Stok Disetujui</span>
      case 'REJECTED':         return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI':return <span className="badge badge-neutral">Selesai</span>
      default:                 return <span className="badge badge-neutral">{status}</span>
    }
  }

  // Separate stock requests from actual demo plot records
  const stockRequests = requests.filter(r => r.commodity === '-' || !r.farmer)
  const demoPlots     = requests.filter(r => r.commodity !== '-' && r.farmer)

  return (
    <div>
      <div className="page-header">
        <h2 style={{ margin: 0 }}>🌾 Demo Plot</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* FO: request stock + direct demo plot */}
          {(session.role === 'FO' || session.role === 'INTERN') && (
            <>
              <Link href="/dashboard/demoplot/request">
                <button className="btn btn-outline">📦 Minta Stok dari AFA</button>
              </Link>
              <Link href="/dashboard/demoplot/new">
                <button className="btn btn-primary">➕ Rekam Demo Plot</button>
              </Link>
            </>
          )}
          {/* AFA: direct demo plot + review stock requests */}
          {session.role === 'AFA' && (
            <>
              <Link href="/dashboard/demoplot/afa-plan">
                <button className="btn btn-outline">📋 Perencanaan Mandiri</button>
              </Link>
              <Link href="/dashboard/demoplot/new">
                <button className="btn btn-primary">➕ Rekam Demo Plot</button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stock Requests Section (AFA approving FO requests) */}
      {session.role === 'AFA' && stockRequests.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📦 Permintaan Stok FO
            {stockRequests.filter(r => r.status === 'SUBMITTED').length > 0 && (
              <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                {stockRequests.filter(r => r.status === 'SUBMITTED').length} baru
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
                    <th>FO Pengaju</th>
                    <th>Catatan</th>
                    <th>Produk Diminta</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRequests.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{req.fo?.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 200 }}>{req.plan !== '-' ? req.plan : '-'}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {req.details?.map((d: any) => {
                          const unit = d.requestUnit || d.product?.unitGramasi || d.product?.unit
                          const qty = d.qtyApproved != null ? `${d.qtyApproved} ${unit} (diminta: ${d.qtyRequested})` : `${d.qtyRequested} ${unit}`
                          return `${d.product?.name}: ${qty}`
                        }).join(', ')}
                      </td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>
                        <div className="action-row">
                          {req.status === 'SUBMITTED' && (
                            <Link href={`/dashboard/demoplot/approve/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Approve Stok</button>
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

      {/* FO: show own stock requests */}
      {(session.role === 'FO' || session.role === 'INTERN') && stockRequests.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📦 Permintaan Stok Saya</h3>
          <div className="table-card">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Tanggal</th><th>Produk Diminta</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRequests.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {req.details?.map((d: any) => {
                          const unit = d.requestUnit || d.product?.unitGramasi || d.product?.unit
                          const qty = d.qtyApproved != null ? `${d.qtyApproved} ${unit} (diminta: ${d.qtyRequested})` : `${d.qtyRequested} ${unit}`
                          return `${d.product?.name}: ${qty}`
                        }).join(', ')}
                      </td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>
                        <div className="action-row">
                          {req.status === 'APPROVED' && req.demoPlots?.length > 0 && req.foId === session.userId && (
                            <Link href={`/dashboard/demoplot/continue/${req.id}`}>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>▶ Lanjutkan Sesi</button>
                            </Link>
                          )}
                          <Link href={`/dashboard/demoplot/detail/${req.id}`}><button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Detail</button></Link>
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

      {/* Demo Plot Records */}
      <h3 style={{ marginBottom: '1rem' }}>🌾 Riwayat Realisasi Demo Plot</h3>
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tanggal</th>
                {session.role !== 'FO' && session.role !== 'INTERN' && <th>Pelaksana</th>}
                <th>Petani / Area</th>
                <th>Komoditas</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {demoPlots.map(req => (
                <tr key={req.id}>
                  <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}</td>
                  {session.role !== 'FO' && session.role !== 'INTERN' && <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{req.fo?.name}</td>}
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.farmer?.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{req.area}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{req.commodity}</td>
                  <td>{getStatusBadge(req.status)}</td>
                  <td>
                    <div className="action-row">
                      {req.status === 'APPROVED' && (req.foId === session.userId || req.afaId === session.userId) && (
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
              {demoPlots.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada realisasi demo plot. Klik "Rekam Demo Plot" untuk memulai.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
