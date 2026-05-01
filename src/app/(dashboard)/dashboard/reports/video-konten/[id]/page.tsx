import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function VideoKontenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const report = await prisma.contentVideo.findUnique({
    where: { id: resolvedParams.id },
    include: {
      user: true,
      products: { include: { product: true } }
    }
  })

  if (!report) notFound()

  let photos: string[] = []
  if (report.photos) {
    try {
      photos = JSON.parse(report.photos)
    } catch { }
  }

  const tdStyle = { padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/reports" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>← Kembali ke Laporan</Link>
        <h2 style={{ margin: 0 }}>Detail Laporan Video Konten</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600, width: '30%' }}>Pelapor</td>
              <td style={tdStyle}>{report.user.name}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal Upload Video</td>
              <td style={tdStyle}>{new Date(report.uploadDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal Submit Sistem</td>
              <td style={tdStyle}>{new Date(report.createdAt).toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Tema</td>
              <td style={tdStyle}>{report.theme}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Produk Terkait</td>
              <td style={tdStyle}>
                {report.products && report.products.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {report.products.map((p: any) => (
                      <li key={p.id}>{p.product?.name}</li>
                    ))}
                  </ul>
                ) : '-'}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Catatan</td>
              <td style={{ ...tdStyle, whiteSpace: 'pre-wrap' }}>{report.notes || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>📸 Dokumentasi Screenshot</h3>
        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={url} alt={`Dokumentasi ${i + 1}`} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tidak ada dokumentasi.</p>
        )}
      </div>
    </div>
  )
}
