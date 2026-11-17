import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import TableFilter from '@/components/TableFilter'
import TablePager from '@/components/TablePager'


const HISTORY_TAKE = 20

export default async function OpnameApproveListPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['ADMIN', 'SPV'].includes(session.role as string)) {
    return <div className="card p-4">Akses Ditolak.</div>
  }

  // Get all SUBMITTED stock opnames
  const opnames = await prisma.stockOpname.findMany({
    where: { status: 'SUBMITTED' },
    include: {
      user: {
        select: { name: true, role: true }
      },
      details: true
    },
    orderBy: { createdAt: 'desc' }
  })

  // Riwayat semua opname yang sudah diproses: filter nama user + rentang tanggal update (WIB), paging
  const q = searchParams.qu?.trim() || ''
  const start = searchParams.start_u ? new Date(`${searchParams.start_u}T00:00:00+07:00`) : null
  const end = searchParams.end_u ? new Date(`${searchParams.end_u}T23:59:59.999+07:00`) : null
  const page = Math.max(1, parseInt(searchParams.pu || '1') || 1)
  const historyRows = await prisma.stockOpname.findMany({
    where: {
      status: { in: ['APPROVED', 'REJECTED'] },
      ...(q ? { user: { name: { contains: q, mode: 'insensitive' as const } } } : {}),
      ...(start || end ? { updatedAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
    },
    include: {
      user: {
        select: { name: true, role: true }
      },
      details: true
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * HISTORY_TAKE,
    take: HISTORY_TAKE + 1,
  })
  const history = historyRows.slice(0, HISTORY_TAKE)
  const historyHasMore = historyRows.length > HISTORY_TAKE

  return (
    <div className="space-y-6">
      <div className="flex-between">
        <div>
          <h2>Persetujuan Stock Opname</h2>
          <p className="text-muted">Kelola pengajuan penyesuaian stok dari AFA dan FO.</p>
        </div>
      </div>

      <div className="card">
        <h3>Menunggu Persetujuan (<span className="num">{opnames.length}</span>)</h3>
        {opnames.length === 0 ? (
          <div className="alert alert-info mt-4">Tidak ada pengajuan Stock Opname saat ini.</div>
        ) : (
          <table className="mt-4" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Tanggal</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Diajukan Oleh</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Jumlah Item</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Item Selisih</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {opnames.map(op => {
                const diffCount = op.details.filter(d => d.variance !== 0).length
                return (
                  <tr key={op.id}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                      {new Date(op.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                      <strong style={{ fontWeight: 500 }}>{op.user.name}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({op.user.role})</span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                      <span className="num">{op.details.length}</span> produk
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                      <span className={diffCount > 0 ? "badge badge-warning" : "badge badge-neutral"}>
                        <span className="num">{diffCount}</span> produk selisih
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                      <Link href={`/dashboard/opname/approve/${op.id}`} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                        Review
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Riwayat Persetujuan</h3>
          <TableFilter prefix="u" showDateRange />
          {history.length === 0 ? (
            <div className="alert alert-info mt-4">Tidak ada riwayat yang cocok dengan filter.</div>
          ) : (
          <div className="table-responsive">
          <table className="mt-4" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Waktu Update</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>User (AFA/FO)</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {history.map(op => (
                <tr key={op.id}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    {new Date(op.updatedAt).toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    {op.user.name}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    <span className={`badge ${op.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                      {op.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    <Link href={`/dashboard/opname/approve/${op.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>Lihat Detail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
          {(historyHasMore || page > 1) && <TablePager prefix="u" currentPage={page} hasMore={historyHasMore} />}
      </div>
    </div>
  )
}
