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

  // Fetch Requests based on Role
  const include = { fo: true, afa: true, farmer: true, details: { include: { product: true } } }
  let requests: any[] = []
  if (session.role === 'FO') {
    requests = await prisma.request.findMany({
      where: { foId: session.userId }, include, orderBy: { createdAt: 'desc' }
    })
  } else if (session.role === 'AFA') {
    requests = await prisma.request.findMany({
      where: { OR: [{ afaId: session.userId }, { foId: session.userId }] }, include, orderBy: { createdAt: 'desc' }
    })
  } else {
    requests = await prisma.request.findMany({ include, orderBy: { createdAt: 'desc' } })
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'SUBMITTED': return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED': return <span className="badge badge-success">Disetujui</span>
      case 'REJECTED': return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI': return <span className="badge badge-neutral">Selesai</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>🌾 Aktivitas Demo Plot</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {session.role === 'FO' && (
            <Link href="/dashboard/demoplot/request">
              <button className="btn btn-primary">➕ Buat Pengajuan Baru</button>
            </Link>
          )}
          {session.role === 'AFA' && (
            <Link href="/dashboard/demoplot/afa-plan">
              <button className="btn btn-primary">📋 Buat Perencanaan Mandiri</button>
            </Link>
          )}
        </div>
      </div>

      <div className="table-card">
        <div className="table-responsive">
           <table>
             <thead>
               <tr>
                 <th>ID Request</th>
                 <th>Tanggal</th>
                 {session.role !== 'FO' && <th>FO Pengaju</th>}
                 <th>Petani / Area</th>
                 <th>Status</th>
                 <th>Aksi</th>
               </tr>
             </thead>
             <tbody>
               {requests.map(req => (
                 <tr key={req.id}>
                   <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                     {req.id.slice(0, 8).toUpperCase()}
                   </td>
                   <td style={{ whiteSpace: 'nowrap' }}>
                     {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(req.createdAt)}
                   </td>
                   {session.role !== 'FO' && (
                      <td style={{ color: 'var(--primary)', fontWeight: 500 }}>
                        {req.fo?.name}
                      </td>
                   )}
                   <td>
                     <div><strong>{req.farmer?.name}</strong></div>
                     <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.area}</div>
                   </td>
                   <td>
                     {getStatusBadge(req.status)}
                   </td>
                   <td>
                      <div className="action-row">
                        <Link href={`/dashboard/demoplot/detail/${req.id}`}>
                          <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Detail</button>
                        </Link>
                                                {session.role === 'AFA' && req.status === 'SUBMITTED' && (
                           <Link href={`/dashboard/demoplot/approve/${req.id}`}>
                             <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Tinjau &amp; Approve</button>
                           </Link>
                         )}
                         {/* AFA can execute their own self-plans (foId === afaId, status APPROVED) */}
                         {(session.role === 'FO' || (session.role === 'AFA' && req.foId === session.userId)) && req.status === 'APPROVED' && (
                           <Link href={`/dashboard/demoplot/execute/${req.id}`}>
                             <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>📝 Realisasi</button>
                           </Link>
                         )}
                      </div>
                   </td>
                 </tr>
               ))}
               {requests.length === 0 && (
                 <tr>
                   <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                     Belum ada data pengajuan demo plot.
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
