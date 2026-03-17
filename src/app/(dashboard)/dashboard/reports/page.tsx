import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function ReportsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return <div>Unauthorized</div>

  const isSPV = session.role === 'ADMIN' || session.role === 'SPV'
  const userFilter = isSPV ? {} : { userId: session.userId }

  const [cbReports, kiosReports, gatheringReports, companyReports] = await Promise.all([
    prisma.customerBehavior.findMany({
      where: userFilter,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.visitKios.findMany({
      where: userFilter,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.farmerGathering.findMany({
      where: userFilter,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.visitCompany.findMany({
      where: userFilter,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
  ])

  const tdStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)' }
  const thStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' as const }

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)

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

      {/* Customer Behavior Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>📝 Customer Behavior</h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Pembuat</th>
                <th style={thStyle}>Nama Petani</th>
                <th style={thStyle}>Komoditas</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cbReports.map(rp => (
                <tr key={rp.id}>
                  <td style={tdStyle}>{formatDate(rp.createdAt)}</td>
                  <td style={tdStyle}>{rp.user.name}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rp.user.role}</div></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{rp.farmerName}</td>
                  <td style={tdStyle}>{rp.commodity || '-'}</td>
                  <td style={tdStyle}>
                    <Link href={`/dashboard/reports/cb/${rp.id}`} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Detail</Link>
                  </td>
                </tr>
              ))}
              {cbReports.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan.</td></tr>
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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan.</td></tr>
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
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
