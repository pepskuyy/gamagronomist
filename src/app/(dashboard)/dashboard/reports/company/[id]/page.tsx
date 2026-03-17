import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function VisitCompanyDetail({ params }: { params: { id: string } }) {
  const report = await prisma.visitCompany.findUnique({
    where: { id: params.id },
    include: { user: true }
  })
  if (!report) return notFound()

  const commodities = report.commodities ? JSON.parse(report.commodities as string) as string[] : []
  const photos      = report.photos      ? JSON.parse(report.photos      as string) as string[] : []

  return (
    <div className="form-container">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Detail Visit Company</h2>
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
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>🏢 Informasi Perusahaan</h3>
        {[
          { label: 'Nama Perusahaan', value: report.companyName },
          { label: 'Kecamatan', value: report.district },
          { label: 'Alamat', value: report.address },
          { label: 'Nama PIC', value: report.picName },
          { label: 'Jabatan PIC', value: report.picPosition },
          { label: 'No. HP PIC', value: report.picPhone },
          { label: 'Luas Lahan', value: report.landArea },
          { label: 'Produk', value: report.products },
          { label: 'Tanggal Pengadaan', value: report.procurementDate ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(report.procurementDate) : null },
          { label: 'Term Pembayaran', value: report.paymentTerm },
        ].map(({ label, value }) =>
          value ? (
            <div key={label} style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
              <div style={{ minWidth: '180px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</div>
              <div style={{ fontWeight: 500, flex: 1 }}>{value}</div>
            </div>
          ) : null
        )}
        {commodities.length > 0 && (
          <div style={{ padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
            <div style={{ minWidth: '180px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Komoditas</div>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {commodities.map(c => <span key={c} className="badge badge-success">{c}</span>)}
            </div>
          </div>
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
