import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ReportAdminActions from '@/components/ReportAdminActions'
import { deleteSpotDemplot } from '@/app/actions/spot-demplot'

const prisma = new PrismaClient()

export default async function SpotDemplotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return redirect('/login')

  const isAdmin = session.role === 'ADMIN'

  const spot = await prisma.spotDemplot.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, role: true, area: { select: { name: true } } } },
      details: { include: { product: { select: { name: true, unit: true } } } },
    }
  })

  if (!spot) return <div className="form-container-wide"><div className="card" style={{ textAlign: 'center', padding: '3rem' }}>Spot Demplot tidak ditemukan.</div></div>

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(d)

  let weeds: string[] = []
  if (spot.weeds) {
    try { weeds = JSON.parse(spot.weeds) } catch { weeds = [spot.weeds] }
  }

  let photos: string[] = []
  if (spot.photos) {
    try { photos = JSON.parse(spot.photos) } catch { photos = [] }
  }

  const infoStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.15rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }
  const valueStyle: React.CSSProperties = { fontWeight: 600, fontSize: '0.95rem' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>🌿 Detail Spot Demplot</h2>
          {isAdmin && (
            <ReportAdminActions type="spot-demplot" id={spot.id} deleteAction={deleteSpotDemplot} />
          )}
        </div>
      </div>

      {/* Info Umum */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Informasi Umum</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div style={infoStyle}>
            <span style={labelStyle}>Pelaksana</span>
            <span style={valueStyle}>{spot.user.name} <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#e5e7eb', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{spot.user.role}</span></span>
          </div>
          <div style={infoStyle}>
            <span style={labelStyle}>Area</span>
            <span style={valueStyle}>{spot.user.area?.name || '-'}</span>
          </div>
          <div style={infoStyle}>
            <span style={labelStyle}>Tanggal Pelaksanaan</span>
            <span style={valueStyle}>{formatDate(spot.date)}</span>
          </div>
          <div style={infoStyle}>
            <span style={labelStyle}>Dibuat Pada</span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{formatDate(spot.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Lokasi */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>📍 Lokasi</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {spot.districtKab && (
            <div style={infoStyle}>
              <span style={labelStyle}>Kabupaten</span>
              <span style={valueStyle}>{spot.districtKab}</span>
            </div>
          )}
          {spot.districtKec && (
            <div style={infoStyle}>
              <span style={labelStyle}>Kecamatan</span>
              <span style={valueStyle}>{spot.districtKec}</span>
            </div>
          )}
          {spot.districtDesa && (
            <div style={infoStyle}>
              <span style={labelStyle}>Desa</span>
              <span style={valueStyle}>{spot.districtDesa}</span>
            </div>
          )}
          {spot.latitude && spot.longitude && (
            <div style={infoStyle}>
              <span style={labelStyle}>Koordinat GPS</span>
              <a
                href={`https://www.google.com/maps?q=${spot.latitude},${spot.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '0.9rem' }}
              >
                {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Pengamatan */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>📝 Hasil Pengamatan</h3>

        {weeds.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <span style={labelStyle}>Jenis Gulma</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              {weeds.map((w, i) => (
                <span key={i} style={{
                  background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
                  padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600
                }}>{w}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {spot.observationResult || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Tidak ada catatan.</span>}
        </div>
      </div>

      {/* Produk */}
      {spot.details.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>🧪 Penggunaan Produk</h3>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--surface-hover)' }}>
                <tr>
                  <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>Produk</th>
                  <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>Jumlah Pakai</th>
                  <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {spot.details.map(det => (
                  <tr key={det.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem' }}>{det.product.name}</td>
                    <td style={{ padding: '0.65rem', fontWeight: 600 }}>{det.usage} {det.product.unit}</td>
                    <td style={{ padding: '0.65rem' }}>
                      {det.usedFarmerProduct
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600 }}>🌾 Petani</span>
                        : <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600 }}>🏢 Stok Sendiri</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dokumentasi */}
      {photos.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>📷 Dokumentasi</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Dokumentasi ${i + 1}`}
                  style={{
                    width: '150px', height: '150px', objectFit: 'cover',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
