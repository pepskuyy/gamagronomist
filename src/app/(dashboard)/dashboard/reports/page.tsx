import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import CbReportTable from '@/components/CbReportTable'
import DemoPlotReportTable from '@/components/DemoPlotReportTable'

const prisma = new PrismaClient()

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ page?: string, search?: string, start?: string, end?: string }> }) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return <div>Unauthorized</div>

  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const take = 10
  const skip = (page - 1) * take

  const search = resolvedParams.search || ''
  const startParam = resolvedParams.start || ''
  const endParam = resolvedParams.end || ''
  
  const startDate = startParam ? new Date(startParam) : undefined
  const endDate = endParam ? new Date(endParam) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    }
  } : {}

  let userFilter: any = {}
  if (['ADMIN', 'SPV'].includes(session.role)) {
    userFilter = {}
  } else if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
    const userIds = [session.userId, ...fos.map(u => u.id)]
    userFilter = { userId: { in: userIds } }
  } else {
    userFilter = { userId: session.userId }
  }

  // Demo Plot filter: use request.foId instead of userId
  let dpUserFilter: any = {}
  if (['ADMIN', 'SPV'].includes(session.role)) {
    dpUserFilter = {}
  } else if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
    const foIds = [session.userId, ...fos.map(u => u.id)]
    dpUserFilter = { request: { foId: { in: foIds } } }
  } else {
    dpUserFilter = { request: { foId: session.userId } }
  }

  const dpDateFilter = startDate || endDate ? {
    date: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    }
  } : {}

  const [cbReports, kiosReports, gatheringReports, companyReports, dpSessions] = await Promise.all([
    prisma.customerBehavior.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { farmerName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take
    }),
    prisma.visitKios.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { kiosName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take
    }),
    prisma.farmerGathering.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { leaderName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take
    }),
    prisma.visitCompany.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { companyName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take
    }),
    prisma.demoPlot.findMany({
      where: { ...dpDateFilter, ...dpUserFilter, ...(search ? { area: { contains: search, mode: 'insensitive' } } : {}) },
      include: { request: { include: { fo: true } } },
      orderBy: { date: 'desc' }, skip, take
    })
  ])

  const tdStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
  const thStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' as const }

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)

  const hasMore = cbReports.length === take || kiosReports.length === take || gatheringReports.length === take || companyReports.length === take || dpSessions.length === take
  const queryStr = `&search=${encodeURIComponent(search)}&start=${startParam}&end=${endParam}`

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Laporan Aktivitas Harian</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/reports/cb/new"        className="btn btn-primary"  style={{ fontSize: '0.85rem' }}>+ 📝 Customer Behavior</Link>
          <Link href="/dashboard/reports/kios/new"      className="btn btn-outline"  style={{ fontSize: '0.85rem' }}>+ 🏪 Visit Kios</Link>
          <Link href="/dashboard/reports/gathering/new" className="btn btn-outline"  style={{ fontSize: '0.85rem' }}>+ 👥 Gathering</Link>
          <Link href="/dashboard/reports/company/new"   className="btn btn-outline"  style={{ fontSize: '0.85rem' }}>+ 🏢 Visit Company</Link>
        </div>
      </div>

      <form method="GET" action="/dashboard/reports" className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'flex-end', background: 'var(--surface-2)' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="form-label">Cari Nama (Petani/Kios/Dll)</label>
          <input type="text" name="search" className="form-control" defaultValue={search} placeholder="Ketik nama..." />
        </div>
        <div>
          <label className="form-label">Tanggal Mulai</label>
          <input type="date" name="start" className="form-control" defaultValue={startParam} />
        </div>
        <div>
          <label className="form-label">Tanggal Akhir</label>
          <input type="date" name="end" className="form-control" defaultValue={endParam} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>🔍 Filter</button>
          {(search || startParam || endParam) && (
            <Link href="/dashboard/reports" className="btn btn-outline" style={{ padding: '0.65rem 1rem' }}>Reset</Link>
          )}
        </div>
      </form>

      {/* Customer Behavior Table */}
      <CbReportTable
        reports={cbReports.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        isAdmin={session.role === 'ADMIN'}
      />

      {/* Demo Plot Realizations Table */}
      <DemoPlotReportTable
        sessions={dpSessions.map(s => ({
          id: s.id,
          date: s.date.toISOString(),
          requestId: s.requestId,
          area: s.area,
          commodity: s.commodity,
          isFinalSession: s.isFinalSession,
          request: s.request ? { fo: { name: s.request.fo.name, role: s.request.fo.role } } : null
        }))}
        isAdmin={session.role === 'ADMIN'}
      />

      {/* Visit Kios Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>🏪 Visit Kios</h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Nama Kios</th>
                <th style={thStyle}>Hasil Kunjungan</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kiosReports.map(rp => (
                <tr key={rp.id}>
                  <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                  <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{rp.kiosName}</td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rp.visitResult || '-'}</td>
                  <td style={tdStyle}>
                    <Link href={`/dashboard/reports/kios/${rp.id}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                  </td>
                </tr>
              ))}
              {kiosReports.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Farmer Gathering Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>🤝 Farmer Gathering</h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Ketua Kelompok</th>
                <th style={thStyle}>Lokasi</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {gatheringReports.map(rp => (
                <tr key={rp.id}>
                  <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                  <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{rp.leaderName || '-'}</td>
                  <td style={tdStyle}>{rp.district || rp.address || '-'}</td>
                  <td style={tdStyle}>
                    <Link href={`/dashboard/reports/gathering/${rp.id}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                  </td>
                </tr>
              ))}
              {gatheringReports.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visit Company Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>🏢 Visit Company</h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Nama Perusahaan</th>
                <th style={thStyle}>Kecamatan</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {companyReports.map(rp => (
                <tr key={rp.id}>
                  <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                  <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{rp.companyName}</td>
                  <td style={tdStyle}>{rp.district || '-'}</td>
                  <td style={tdStyle}>
                    <Link href={`/dashboard/reports/company/${rp.id}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                  </td>
                </tr>
              ))}
              {companyReports.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '3rem' }}>
        {page > 1 ? (
          <Link href={`/dashboard/reports?page=${page - 1}${queryStr}`} className="btn btn-outline">← Sebelumnya</Link>
        ) : (
          <button className="btn btn-outline" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>← Sebelumnya</button>
        )}
        
        <span style={{ padding: '0.5rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
          Halaman {page}
        </span>
        
        {hasMore ? (
          <Link href={`/dashboard/reports?page=${page + 1}${queryStr}`} className="btn btn-outline">Selanjutnya →</Link>
        ) : (
          <button className="btn btn-outline" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Selanjutnya →</button>
        )}
      </div>

    </div>
  )
}

