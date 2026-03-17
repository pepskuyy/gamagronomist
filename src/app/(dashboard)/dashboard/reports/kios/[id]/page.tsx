import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function VisitKiosDetail({ params }: { params: { id: string } }) {
  const report = await prisma.visitKios.findUnique({
    where: { id: params.id },
    include: { user: true }
  })
  if (!report) return notFound()

  const photos = report.photos ? JSON.parse(report.photos as string) as string[] : []

  return (
    <div className="form-container">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Detail Visit Kios</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dicatat oleh</div>
          <div style={{ fontWeight: 700 }}>{report.user.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>({report.user.role})</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tanggal</div>
          <div style={{ fontWeight: 600 }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(report.createdAt)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>🏪 Informasi Kunjungan</h3>
        {[
          { label: 'Nama Kios', value: report.kiosName },
          { label: 'Detail Aktivitas', value: report.activityDetail },
          { label: 'Hasil Kunjungan', value: report.visitResult },
          { label: 'Catatan', value: report.notes },
        ].map(({ label, value }) =>
          value ? (
            <div key={label} style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
              <div style={{ minWidth: '160px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</div>
              <div style={{ fontWeight: 500, flex: 1, whiteSpace: 'pre-line' }}>{value}</div>
            </div>
          ) : null
        )}
      </div>

      {photos.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>📷 Dokumentasi</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Foto ${i + 1}`} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border)' }} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
