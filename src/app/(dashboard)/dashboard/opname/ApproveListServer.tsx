import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'


export default async function OpnameApproveListPage() {
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

  // Get recently approved/rejected to show history
  const history = await prisma.stockOpname.findMany({
    where: { status: { in: ['APPROVED', 'REJECTED'] } },
    include: {
      user: {
        select: { name: true, role: true }
      },
      details: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 10
  })

  return (
    <div className="space-y-6">
      <div className="flex-between">
        <div>
          <h2>Persetujuan Stock Opname</h2>
          <p className="text-muted">Kelola pengajuan penyesuaian stok dari AFA dan FO.</p>
        </div>
      </div>

      <div className="card">
        <h3>Menunggu Persetujuan ({opnames.length})</h3>
        {opnames.length === 0 ? (
          <div className="alert alert-info mt-4">Tidak ada pengajuan Stock Opname saat ini.</div>
        ) : (
          <table className="mt-4" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Tanggal</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Diajukan Oleh</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Jumlah Item</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Item Selisih</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {opnames.map(op => {
                const diffCount = op.details.filter(d => d.variance !== 0).length
                return (
                  <tr key={op.id}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      {new Date(op.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <strong>{op.user.name}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({op.user.role})</span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      {op.details.length} produk
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span className={diffCount > 0 ? "badge badge-warning" : "badge badge-neutral"}>
                        {diffCount} produk selisih
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      <Link href={`/dashboard/opname/approve/${op.id}`} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
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

      {history.length > 0 && (
        <div className="card">
          <h3>Riwayat Persetujuan (Terbaru)</h3>
          <table className="mt-4" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Waktu Update</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>User (AFA/FO)</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Status</th>
                <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {history.map(op => (
                <tr key={op.id}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    {new Date(op.updatedAt).toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    {op.user.name}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <span className={`badge ${op.status === 'APPROVED' ? 'badge-success' : 'badge-error'}`}>
                      {op.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <Link href={`/dashboard/opname/approve/${op.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>Lihat Detail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
