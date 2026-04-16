import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import CbReportTable from '@/components/CbReportTable'
import ExportExcelButton from '@/components/ExportExcelButton'

const prisma = new PrismaClient()

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function parseDate(v: string | undefined): Date | undefined {
  return v ? new Date(v) : undefined
}
function parseDateEnd(v: string | undefined): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  d.setHours(23, 59, 59, 999)
  return d
}
function dateFilter(start?: Date, end?: Date) {
  if (!start && !end) return {}
  return { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
}

// Builds a URL that keeps ALL existing params but sets/overrides paramName → value
function buildHref(allParams: URLSearchParams, paramName: string, value: string) {
  const p = new URLSearchParams(allParams)
  p.set(paramName, value)
  return `/dashboard/reports?${p.toString()}`
}

function TablePager({
  paramName, currentPage, hasMore, allParams,
}: {
  paramName: string; currentPage: number; hasMore: boolean; allParams: URLSearchParams
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
      {currentPage > 1 ? (
        <Link href={buildHref(allParams, paramName, String(currentPage - 1))} className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>← Prev</Link>
      ) : (
        <button className="btn btn-outline" disabled style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: 0.4, cursor: 'not-allowed' }}>← Prev</button>
      )}
      <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Hal {currentPage}</span>
      {hasMore ? (
        <Link href={buildHref(allParams, paramName, String(currentPage + 1))} className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>Next →</Link>
      ) : (
        <button className="btn btn-outline" disabled style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: 0.4, cursor: 'not-allowed' }}>Next →</button>
      )}
    </div>
  )
}

/**
 * Inline filter strip per table. Uses form GET so it's a server-rendered navigation.
 * prefix: e.g. "cb" → params: cb_q, cb_start, cb_end, pcb
 */
function TableFilter({
  prefix, searchLabel, currentQ, currentStart, currentEnd, allParams,
}: {
  prefix: string; searchLabel: string
  currentQ: string; currentStart: string; currentEnd: string
  allParams: URLSearchParams
}) {
  // Build a hidden-input snapshot of all OTHER params so they are preserved on submit
  const otherParams: Record<string, string> = {}
  allParams.forEach((v, k) => {
    // reset page for this table on new filter
    if (k !== `${prefix}_q` && k !== `${prefix}_start` && k !== `${prefix}_end` && k !== `p${prefix}`) {
      otherParams[k] = v
    }
  })
  const isActive = currentQ || currentStart || currentEnd
  const resetParams = new URLSearchParams(allParams)
  resetParams.delete(`${prefix}_q`)
  resetParams.delete(`${prefix}_start`)
  resetParams.delete(`${prefix}_end`)
  resetParams.delete(`p${prefix}`)

  return (
    <form method="GET" action="/dashboard/reports"
      style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.85rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}
    >
      {/* Preserve all other params */}
      {Object.entries(otherParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div style={{ flex: '1 1 180px' }}>
        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>{searchLabel}</label>
        <input type="text" name={`${prefix}_q`} className="form-control" defaultValue={currentQ} placeholder="Cari..." style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }} />
      </div>
      <div>
        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Dari</label>
        <input type="date" name={`${prefix}_start`} className="form-control" defaultValue={currentStart} style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }} />
      </div>
      <div>
        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Sampai</label>
        <input type="date" name={`${prefix}_end`} className="form-control" defaultValue={currentEnd} style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}>🔍 Filter</button>
        {isActive && (
          <Link href={`/dashboard/reports?${resetParams.toString()}`} className="btn btn-outline" style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}>✕ Reset</Link>
        )}
      </div>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!session?.userId) return <div>Unauthorized</div>

  const rp = await searchParams
  const take = 10

  // Per-table pages
  const pcb     = Math.max(1, parseInt(rp.pcb     || '1'))
  const pdp     = Math.max(1, parseInt(rp.pdp     || '1'))
  const pkios   = Math.max(1, parseInt(rp.pkios   || '1'))
  const pgather = Math.max(1, parseInt(rp.pgather || '1'))
  const pcomp   = Math.max(1, parseInt(rp.pcomp   || '1'))
  const pspot   = Math.max(1, parseInt(rp.pspot   || '1'))

  // Per-table filter params  (prefix_q, prefix_start, prefix_end)
  const cbQ      = rp.cb_q      || ''; const cbStart = rp.cb_start    || ''; const cbEnd  = rp.cb_end    || ''
  const dpQ      = rp.dp_q      || ''; const dpStart = rp.dp_start    || ''; const dpEnd  = rp.dp_end    || ''
  const kiosQ    = rp.kios_q    || ''; const kiosStart = rp.kios_start  || ''; const kiosEnd = rp.kios_end   || ''
  const gatherQ  = rp.gather_q  || ''; const gatherStart = rp.gather_start || ''; const gatherEnd = rp.gather_end  || ''
  const compQ    = rp.comp_q    || ''; const compStart = rp.comp_start  || ''; const compEnd = rp.comp_end   || ''
  const spotQ    = rp.spot_q    || ''; const spotStart = rp.spot_start  || ''; const spotEnd = rp.spot_end   || ''

  // Snapshot of ALL current params (for pagination links that preserve filters)
  const allParams = new URLSearchParams(
    Object.fromEntries(Object.entries(rp).filter(([, v]) => v !== undefined)) as Record<string, string>
  )

  // ── User scope ─────────────────────────────────────────────────────────────
  let userIds: string[] | null = null // null = no restriction (ADMIN/SPV sees all)
  if (session.role === 'AFA') {
    const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
    userIds = [session.userId, ...fos.map(u => u.id)]
  } else if (!['ADMIN', 'SPV'].includes(session.role)) {
    userIds = [session.userId]
  }

  function userFilter() {
    return userIds ? { userId: { in: userIds as string[] } } : {}
  }

  // Demo Plot Request scope
  function dpWhere(q: string, startP: string, endP: string) {
    let base: any = { commodity: { not: '-' }, farmer: { isNot: null } }
    if (!['ADMIN', 'SPV'].includes(session.role)) {
      if (session.role === 'AFA') {
        const foIds = userIds || []
        base = { ...base, OR: [{ foId: { in: foIds } }, { afaId: session.userId }] }
      } else {
        base = { ...base, foId: session.userId }
      }
    }
    if (q) base.farmer = { name: { contains: q, mode: 'insensitive' } }
    const sd = parseDate(startP); const ed = parseDateEnd(endP)
    if (sd || ed) base.createdAt = { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) }
    return base
  }

  function activityWhere(searchField: string, q: string, startP: string, endP: string) {
    const sd = parseDate(startP); const ed = parseDateEnd(endP)
    return {
      ...userFilter(),
      ...dateFilter(sd, ed),
      ...(q ? { [searchField]: { contains: q, mode: 'insensitive' } } : {}),
    }
  }

  // ── Fetch all tables ────────────────────────────────────────────────────────
  const [cbRows, dpRows, kiosRows, gatherRows, compRows, spotRows] = await Promise.all([
    prisma.customerBehavior.findMany({
      where: activityWhere('farmerName', cbQ, cbStart, cbEnd),
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pcb - 1) * take, take: take + 1,
    }),
    prisma.request.findMany({
      where: dpWhere(dpQ, dpStart, dpEnd),
      include: { fo: true, afa: true, farmer: true, details: { include: { product: true } }, demoPlots: { select: { id: true, isFinalSession: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pdp - 1) * take, take: take + 1,
    }),
    prisma.visitKios.findMany({
      where: activityWhere('kiosName', kiosQ, kiosStart, kiosEnd),
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pkios - 1) * take, take: take + 1,
    }),
    prisma.farmerGathering.findMany({
      where: activityWhere('leaderName', gatherQ, gatherStart, gatherEnd),
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pgather - 1) * take, take: take + 1,
    }),
    prisma.visitCompany.findMany({
      where: activityWhere('companyName', compQ, compStart, compEnd),
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pcomp - 1) * take, take: take + 1,
    }),
    prisma.spotDemplot.findMany({
      where: activityWhere('districtDesa', spotQ, spotStart, spotEnd),
      include: { user: true }, orderBy: { createdAt: 'desc' },
      skip: (pspot - 1) * take, take: take + 1,
    }),
  ])

  const cbHasMore     = cbRows.length     > take
  const dpHasMore     = dpRows.length     > take
  const kiosHasMore   = kiosRows.length   > take
  const gatherHasMore = gatherRows.length > take
  const compHasMore   = compRows.length   > take
  const spotHasMore   = spotRows.length   > take

  const cbSlice     = cbRows.slice(0, take)
  const dpSlice     = dpRows.slice(0, take)
  const kiosSlice   = kiosRows.slice(0, take)
  const gatherSlice = gatherRows.slice(0, take)
  const compSlice   = compRows.slice(0, take)
  const spotSlice   = spotRows.slice(0, take)

  const tdStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
  const thStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase', background: 'var(--surface-hover)' }
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':         return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED':          return <span className="badge badge-success">Stok Disetujui</span>
      case 'REJECTED':          return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI': return <span className="badge badge-neutral">Selesai</span>
      default:                  return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Laporan Aktivitas Harian</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/reports/cb/new"           className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 📝 Customer Behavior</Link>
          <Link href="/dashboard/reports/spot-demplot/new" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🌿 Spot Demplot</Link>
          <Link href="/dashboard/reports/kios/new"         className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🏪 Visit Kios</Link>
          <Link href="/dashboard/reports/gathering/new"    className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 👥 Gathering</Link>
          <Link href="/dashboard/reports/company/new"      className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🏢 Visit Company</Link>
          {['FO', 'INTERN', 'AFA'].includes(session.role) && (
            <Link href="/dashboard/demoplot/new" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>+ 🌾 Rekam Demo Plot</Link>
          )}
        </div>
      </div>

      {/* ══ Customer Behavior ══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '2rem' }}>
        <TableFilter prefix="cb" searchLabel="Cari Nama Petani" currentQ={cbQ} currentStart={cbStart} currentEnd={cbEnd} allParams={allParams} />
        <CbReportTable
          reports={cbSlice.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))}
          isAdmin={session.role === 'ADMIN'}
          exportNode={<ExportExcelButton type="cb" search={cbQ} start={cbStart} end={cbEnd} />}
        />
        {(cbHasMore || pcb > 1) && <TablePager paramName="pcb" currentPage={pcb} hasMore={cbHasMore} allParams={allParams} />}
      </div>

      {/* ══ Spot Demplot ═══════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🌿 Riwayat Spot Demplot</h3>
          <ExportExcelButton type="spot-demplot" search={spotQ} start={spotStart} end={spotEnd} />
        </div>
        <TableFilter prefix="spot" searchLabel="Cari Desa / Kecamatan" currentQ={spotQ} currentStart={spotStart} currentEnd={spotEnd} allParams={allParams} />
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Lokasi</th>
                <th style={thStyle}>Hasil Pengamatan</th>
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
                    <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => alert('Detail belum tersedia')}>Detail</button>
                  </td>
                </tr>
              ))}
              {spotSlice.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada laporan yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(spotHasMore || pspot > 1) && <TablePager paramName="pspot" currentPage={pspot} hasMore={spotHasMore} allParams={allParams} />}
      </div>

      {/* ══ Realisasi Demo Plot ════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🌾 Riwayat Realisasi Demo Plot</h3>
          <ExportExcelButton type="demoplot" search={dpQ} start={dpStart} end={dpEnd} />
        </div>
        <TableFilter prefix="dp" searchLabel="Cari Nama Petani" currentQ={dpQ} currentStart={dpStart} currentEnd={dpEnd} allParams={allParams} />
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Tanggal</th>
                {!['FO', 'INTERN'].includes(session.role) && <th style={thStyle}>Pelaksana</th>}
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
                  {!['FO', 'INTERN'].includes(session.role) && <td style={{ ...tdStyle, color: 'var(--primary)', fontWeight: 500 }}>{req.fo?.name}</td>}
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
                <tr><td colSpan={7} style={{ ...tdStyle, padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada realisasi demo plot.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(dpHasMore || pdp > 1) && <TablePager paramName="pdp" currentPage={pdp} hasMore={dpHasMore} allParams={allParams} />}
      </div>

      {/* ══ Visit Kios ════════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🏪 Visit Kios</h3>
          <ExportExcelButton type="kios" search={kiosQ} start={kiosStart} end={kiosEnd} />
        </div>
        <TableFilter prefix="kios" searchLabel="Cari Nama Kios" currentQ={kiosQ} currentStart={kiosStart} currentEnd={kiosEnd} allParams={allParams} />
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada laporan yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(kiosHasMore || pkios > 1) && <TablePager paramName="pkios" currentPage={pkios} hasMore={kiosHasMore} allParams={allParams} />}
      </div>

      {/* ══ Farmer Gathering ══════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🤝 Farmer Gathering</h3>
          <ExportExcelButton type="gathering" search={gatherQ} start={gatherStart} end={gatherEnd} />
        </div>
        <TableFilter prefix="gather" searchLabel="Cari Ketua Kelompok" currentQ={gatherQ} currentStart={gatherStart} currentEnd={gatherEnd} allParams={allParams} />
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada laporan yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(gatherHasMore || pgather > 1) && <TablePager paramName="pgather" currentPage={pgather} hasMore={gatherHasMore} allParams={allParams} />}
      </div>

      {/* ══ Visit Company ══════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🏢 Visit Company</h3>
          <ExportExcelButton type="company" search={compQ} start={compStart} end={compEnd} />
        </div>
        <TableFilter prefix="comp" searchLabel="Cari Nama Perusahaan" currentQ={compQ} currentStart={compStart} currentEnd={compEnd} allParams={allParams} />
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Belum ada laporan yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(compHasMore || pcomp > 1) && <TablePager paramName="pcomp" currentPage={pcomp} hasMore={compHasMore} allParams={allParams} />}
      </div>
    </div>
  )
}
