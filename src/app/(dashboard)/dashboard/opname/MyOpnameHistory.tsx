import prisma from '@/lib/prisma'
import Link from 'next/link'

const STATUS: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Menunggu', cls: 'badge-warning' },
  APPROVED: { label: 'Disetujui', cls: 'badge-success' },
  REJECTED: { label: 'Ditolak', cls: 'badge-danger' },
}

/** Riwayat opname milik user sendiri (AFA/FO), terbaru dulu. */
export default async function MyOpnameHistory({ userId }: { userId: string }) {
  const rows = await prisma.stockOpname.findMany({
    where: { userId },
    include: { details: { select: { variance: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const th = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' } as const
  const td = { padding: '0.75rem', borderBottom: '1px solid var(--border-light)' } as const

  return (
    <div className="card" style={{ maxWidth: '900px', margin: '1.5rem auto 0' }}>
      <h3 style={{ marginBottom: '1rem' }}>Riwayat Opname Saya</h3>
      {rows.length === 0 ? (
        <p className="text-muted">Belum ada pengajuan opname.</p>
      ) : (
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <th style={th}>Diajukan</th>
                <th style={th}>Jumlah Item</th>
                <th style={th}>Item Selisih</th>
                <th style={th}>Status</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(op => {
                const s = STATUS[op.status] ?? { label: op.status, cls: 'badge-neutral' }
                return (
                  <tr key={op.id}>
                    <td style={td}>{new Date(op.createdAt).toLocaleString('id-ID')}</td>
                    <td style={td}><span className="num">{op.details.length}</span> produk</td>
                    <td style={td}><span className="num">{op.details.filter(d => d.variance !== 0).length}</span> produk</td>
                    <td style={td}><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    <td style={td}>
                      <Link href={`/dashboard/opname/approve/${op.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>Lihat Detail</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
