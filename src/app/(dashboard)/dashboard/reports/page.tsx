import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import CbReportTable from '@/components/CbReportTable'
import ExportExcelButton from '@/components/ExportExcelButton'

const prisma = new PrismaClient()

// Pagination helper component
function TablePager({ paramName, currentPage, hasMore, baseQuery }: { paramName: string; currentPage: number; hasMore: boolean; baseQuery: string }) {
  function buildHref(p: number) {
    const params = new URLSearchParams(baseQuery)
    params.set(paramName, String(p))
    return `/dashboard/reports?${params.toString()}`
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0 0.25rem' }}>
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>← Prev</Link>
      ) : (
        <button className="btn btn-outline" disabled style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: 0.4, cursor: 'not-allowed' }}>← Prev</button>
      )}
      <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
        Hal {currentPage}
      </span>
      {hasMore ? (
        <Link href={buildHref(currentPage + 1)} className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>Next →</Link>
      ) : (
        <button className="btn btn-outline" disabled style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: 0.4, cursor: 'not-allowed' }}>Next →</button>
      )}
    </div>
  )
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return <div>Unauthorized</div>

  const resolvedParams = await searchParams
  const take = 10

  // Per-table page params
  const pcb      = Math.max(1, parseInt(resolvedParams.pcb      || '1'))
  const pdp      = Math.max(1, parseInt(resolvedParams.pdp      || '1'))
  const pkios    = Math.max(1, parseInt(resolvedParams.pkios    || '1'))
  const pgather  = Math.max(1, parseInt(resolvedParams.pgather  || '1'))
  const pcomp    = Math.max(1, parseInt(resolvedParams.pcomp    || '1'))
  const pspot    = Math.max(1, parseInt(resolvedParams.pspot    || '1'))

  const search     = resolvedParams.search || ''
  const startParam = resolvedParams.start  || ''
  const endParam   = resolvedParams.end    || ''
  
  const startDate = startParam ? new Date(startParam) : undefined
  const endDate = endParam ? new Date(endParam) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

  // Build a base query string that preserves all page params + filters
  const baseParams = new URLSearchParams()
  if (search)     baseParams.set('search', search)
  if (startParam) baseParams.set('start', startParam)
  if (endParam)   baseParams.set('end', endParam)
  if (pcb > 1)    baseParams.set('pcb', String(pcb))
  if (pdp > 1)    baseParams.set('pdp', String(pdp))
  if (pkios > 1)  baseParams.set('pkios', String(pkios))
  if (pgather > 1) baseParams.set('pgather', String(pgather))
  if (pcomp > 1)  baseParams.set('pcomp', String(pcomp))
  if (pspot > 1)  baseParams.set('pspot', String(pspot))
  const baseQuery = baseParams.toString()

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

  // Demo Plot Request filter
  let dpRequestFilter: any = { commodity: { not: '-' }, farmer: { isNot: null } }
  if (['ADMIN', 'SPV'].includes(session.role)) {
    // see all
  } else if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
    const foIds = [session.userId, ...fos.map(u => u.id)]
    dpRequestFilter = { ...dpRequestFilter, OR: [{ foId: { in: foIds } }, { afaId: session.userId }] }
  } else {
    dpRequestFilter = { ...dpRequestFilter, foId: session.userId }
  }

  if (startDate || endDate) {
    dpRequestFilter.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    }
  }

  const [cbReports, dpRequests, kiosReports, gatheringReports, companyReports, spotReports] = await Promise.all([
    prisma.customerBehavior.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { farmerName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pcb - 1) * take, take: take + 1,
    }),
    prisma.request.findMany({
      where: dpRequestFilter,
      include: { fo: true, afa: true, farmer: true, details: { include: { product: true } }, demoPlots: { select: { id: true, isFinalSession: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pdp - 1) * take, take: take + 1,
    }),
    prisma.visitKios.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { kiosName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pkios - 1) * take, take: take + 1,
    }),
    prisma.farmerGathering.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { leaderName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pgather - 1) * take, take: take + 1,
    }),
    prisma.visitCompany.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { companyName: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pcomp - 1) * take, take: take + 1,
    }),
    prisma.spotDemplot.findMany({
      where: { ...userFilter, ...dateFilter, ...(search ? { districtDesa: { contains: search, mode: 'insensitive' } } : {}) },
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pspot - 1) * take, take: take + 1,
    })
  ])

  // Determine "has more" per table (we fetched take+1 rows)
  const cbHasMore      = cbReports.length > take
  const dpHasMore      = dpRequests.length > take
  const kiosHasMore    = kiosReports.length > take
  const gatherHasMore  = gatheringReports.length > take
  const compHasMore    = companyReports.length > take
  const spotHasMore    = spotReports.length > take

  // Trim the extra row
  const cbSlice      = cbReports.slice(0, take)
  const dpSlice      = dpRequests.slice(0, take)
  const kiosSlice    = kiosReports.slice(0, take)
  const gatherSlice  = gatheringReports.slice(0, take)
  const compSlice    = companyReports.slice(0, take)
  const spotSlice    = spotReports.slice(0, take)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':        return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED':         return <span className="badge badge-success">Stok Disetujui</span>
      case 'REJECTED':         return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI':return <span className="badge badge-neutral">Selesai</span>
      default:                 return <span className="badge badge-neutral">{status}</span>
    }
  }

  const tdStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
  const thStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' as const }

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Laporan Aktivitas Harian</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/reports/cb/new"           className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 📝 Customer Behavior</Link>
          <Link href="/dashboard/reports/spot-demplot/new" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🌿 Spot Demplot</Link>
          <Link href="/dashboard/reports/kios/new"         className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🏪 Visit Kios</Link>
          <Link href="/dashboard/reports/gathering/new"    className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 👥 Gathering</Link>
          <Link href="/dashboard/reports/company/new"      className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🏢 Visit Company</Link>

          {/* Demo Plot buttons */}
          {(session.role === 'FO' || session.role === 'INTERN') && (
            <Link href="/dashboard/demoplot/new" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🌾 Rekam Demo Plot</Link>
          )}
          {session.role === 'AFA' && (
            <Link href="/dashboard/demoplot/new" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🌾 Rekam Demo Plot</Link>
          )}
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

      {/* ── Customer Behavior ── */}
      <CbReportTable
        reports={cbSlice.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        isAdmin={session.role === 'ADMIN'}
        exportNode={<ExportExcelButton type="cb" search={search} start={startParam} end={endParam} />}
      />
      {(cbHasMore || pcb > 1) && (
        <div style={{ marginTop: '-1rem', marginBottom: '2rem' }}>
          <TablePager paramName="pcb" currentPage={pcb} hasMore={cbHasMore} baseQuery={baseQuery} />
        </div>
      )}

      {/* ── Spot Demplot ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>🌿 Riwayat Spot Demplot</h3>
          <ExportExcelButton type="spot-demplot" search={search} start={startParam} end={endParam} />
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Lokasi</th>
                <th style={thStyle}>Hasil Pengamatan</th>
                {/* Aksi bisa kita matikan dulu / dummy untuk format konsistensi */}
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {spotSlice.map(rp => (
                <tr key={rp.id}>
                  <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                  <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                  <td style={tdStyle}>{rp.districtDesa || rp.districtKab || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rp.observationResult || '-'}</td>
                  <td style={tdStyle}>
                    {/* Placeholder button since there's no detail page yet based on minimum requirements */}
                    <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => alert('Detail belum tersedia')}>Detail</button>
                  </td>
                </tr>
              ))}
              {spotSlice.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(spotHasMore || pspot > 1) && (
          <TablePager paramName="pspot" currentPage={pspot} hasMore={spotHasMore} baseQuery={baseQuery} />
        )}
      </div>

      {/* ── Riwayat Realisasi Demo Plot ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>🌾 Riwayat Realisasi Demo Plot</h3>
          <ExportExcelButton type="demoplot" search={search} start={startParam} end={endParam} />
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Tanggal</th>
                {!['FO','INTERN'].includes(session.role) && <th style={thStyle}>Pelaksana</th>}
                <th style={thStyle}>Petani / Area</th>
                <th style={thStyle}>Komoditas</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dpSlice.map((req: any) => (
                <tr key={req.id}>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', fontFamily: 'monospace' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatDate(req.createdAt)}</td>
                  {!['FO','INTERN'].includes(session.role) && <td style={{ ...tdStyle, color: 'var(--primary)', fontWeight: 500 }}>{req.fo?.name}</td>}
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{req.farmer?.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{req.area}</div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.85rem' }}>{req.commodity}</td>
                  <td style={tdStyle}>{getStatusBadge(req.status)}</td>
                  <td style={tdStyle}>
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
              {dpSlice.length === 0 && (
                <tr><td colSpan={7} style={{ ...tdStyle, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada realisasi demo plot.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(dpHasMore || pdp > 1) && (
          <TablePager paramName="pdp" currentPage={pdp} hasMore={dpHasMore} baseQuery={baseQuery} />
        )}
      </div>

      {/* ── Visit Kios ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>🏪 Visit Kios</h3>
          <ExportExcelButton type="kios" search={search} start={startParam} end={endParam} />
        </div>
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
              {kiosSlice.map(rp => (
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
              {kiosSlice.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(kiosHasMore || pkios > 1) && (
          <TablePager paramName="pkios" currentPage={pkios} hasMore={kiosHasMore} baseQuery={baseQuery} />
        )}
      </div>

      {/* ── Farmer Gathering ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>🤝 Farmer Gathering</h3>
          <ExportExcelButton type="gathering" search={search} start={startParam} end={endParam} />
        </div>
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
              {gatherSlice.map(rp => (
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
              {gatherSlice.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(gatherHasMore || pgather > 1) && (
          <TablePager paramName="pgather" currentPage={pgather} hasMore={gatherHasMore} baseQuery={baseQuery} />
        )}
      </div>

      {/* ── Visit Company ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>🏢 Visit Company</h3>
          <ExportExcelButton type="company" search={search} start={startParam} end={endParam} />
        </div>
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
              {compSlice.map(rp => (
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
              {compSlice.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan di halaman ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(compHasMore || pcomp > 1) && (
          <TablePager paramName="pcomp" currentPage={pcomp} hasMore={compHasMore} baseQuery={baseQuery} />
        )}
      </div>

    </div>
  )
}
