import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function CustomerBehaviorDetail({ params }: { params: { id: string } }) {
  const report = await prisma.customerBehavior.findUnique({
    where: { id: params.id },
    include: { user: true }
  })

  if (!report) return notFound()

  const optTypes  = report.optTypes  ? JSON.parse(report.optTypes  as string) as string[] : []
  const optDetails= report.optDetails? JSON.parse(report.optDetails as string) as string[] : []
  const photos    = report.photos    ? JSON.parse(report.photos    as string) as string[] : []

  const row = (label: string, value?: string | null) =>
    value ? (
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
        <div style={{ minWidth: '180px', color: 'var(--text-muted)', fontSize: '0.85rem', paddingTop: '0.1rem' }}>{label}</div>
        <div style={{ fontWeight: 500, flex: 1 }}>{value}</div>
      </div>
    ) : null

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '1rem' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Detail Customer Behavior</h2>
      </div>

      {/* Meta */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dicatat oleh</div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{report.user.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>({report.user.role})</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tanggal</div>
          <div style={{ fontWeight: 600 }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(report.createdAt)}</div>
        </div>
      </div>

      {/* Profil Petani */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>👤 Profil Petani</h3>
        {row('Nama Petani', report.farmerName)}
        {row('Umur', report.age)}
        {row('No. HP', report.phone)}
        {row('Alamat', report.address)}
        {row('Kabupaten/Kota', report.district)}
      </div>

      {/* Data Pertanian */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>🌾 Data Pertanian &amp; Kendala</h3>
        {row('Komoditas', report.commodity)}
        {row('Alasan Komoditas', report.reasonChoice)}
        {row('Kendala', report.constraints)}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
          <div style={{ minWidth: '180px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>OPT</div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {optTypes.length ? optTypes.map(t => <span key={t} className="badge badge-success">{t}</span>) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
          </div>
        </div>
        <div style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem' }}>
          <div style={{ minWidth: '180px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Detail OPT</div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {optDetails.length ? optDetails.map(d => <span key={d} className="badge badge-neutral">{d}</span>) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
          </div>
        </div>
      </div>

      {/* Preferensi Produk */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>🛒 Preferensi Produk</h3>
        {row('Produk yang Dipakai', report.usedProducts)}
        {row('Kios Tempat Membeli', report.buyLocation)}
        {row('Alasan Beli', report.buyReason)}
        {row('Referensi', report.references)}
        {row('Catatan', report.notes)}
      </div>

      {/* Foto */}
      {photos.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
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
