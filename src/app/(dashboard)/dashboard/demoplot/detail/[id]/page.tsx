import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ReportAdminActions from '@/components/ReportAdminActions'
import { deleteDemoPlot } from '@/app/actions/demoplot-admin'


export default async function DemoPlotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) {
    return redirect('/login')
  }

  const isAdmin = session.role === 'ADMIN'

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      fo: true,
      farmer: true,
      details: { include: { product: true } },
      demoPlots: { 
        include: { details: { include: { product: true } } },
        orderBy: { date: 'asc' }
      }
    }
  })

  if (!request) return <div>Pengajuan tidak ditemukan</div>

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'SUBMITTED': return <span className="badge badge-warning">Menunggu Approval</span>
      case 'APPROVED': return <span className="badge badge-success">Disetujui</span>
      case 'REJECTED': return <span className="badge badge-danger">Ditolak</span>
      case 'DEMO_PLOT_SELESAI': return <span className="badge badge-neutral">Selesai</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <h2 style={{ margin: 0 }}>Detail Pengajuan Demo Plot</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Informasi Utama</h3>
          {getStatusBadge(request.status)}
        </div>
        
        <div className="detail-grid">
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Field Officer (FO)</p>
             <p style={{ fontWeight: 600 }}>{request.fo.name}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Tanggal Pengajuan</p>
             <p style={{ fontWeight: 600 }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(request.createdAt)}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Petani & Wilayah</p>
             <p style={{ fontWeight: 600 }}>{request.farmer?.name} - {request.area}</p>
           </div>
           <div>
             <p className="form-label" style={{ marginBottom: '0.2rem' }}>Komoditas</p>
             <p style={{ fontWeight: 600 }}>{request.commodity}</p>
           </div>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
           <p className="form-label" style={{ marginBottom: '0.2rem' }}>Masalah Utama (CB)</p>
           <p style={{ background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>{request.problem}</p>
        </div>
        <div>
           <p className="form-label" style={{ marginBottom: '0.2rem' }}>Rencana Eksekusi</p>
           <p style={{ background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>{request.plan}</p>
        </div>
      </div>



      {request.demoPlots.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Sesi Realisasi (Eksekusi)</h3>
          {request.demoPlots.map((dp, index) => (
            <div key={dp.id} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <strong style={{ color: 'var(--primary)' }}>Sesi ke-{index + 1}</strong>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(dp.date)}
                  </span>
                  {isAdmin && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <ReportAdminActions type="demoplot" id={dp.id} deleteAction={deleteDemoPlot} />
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {(dp as any).cropAgeDays && <div><strong>Umur Tanaman:</strong> {(dp as any).cropAgeDays} HST</div>}
                {dp.landSize && <div><strong>Luas Lahan:</strong> {dp.landSize} {(dp as any).landSizeUnit === 'm2' ? 'm²' : 'ha'}</div>}
                {dp.latitude && dp.longitude && (
                  <div>
                    <strong>Lokasi (GPS):</strong> <a href={`https://www.google.com/maps?q=${dp.latitude},${dp.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--secondary)' }}>{dp.latitude.toFixed(6)}, {dp.longitude.toFixed(6)} ↗</a>
                  </div>
                )}
              </div>

              {dp.resultNotes && (
                <div style={{ marginBottom: '1rem', fontSize: '0.85rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '4px' }}>
                  <strong>Catatan Hasil:</strong> {dp.resultNotes}
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem' }}>Produk</th>
                    <th style={{ padding: '0.5rem' }}>Actual Usage</th>
                    <th style={{ padding: '0.5rem' }}>Sumber Produk</th>
                  </tr>
                </thead>
                <tbody>
                  {dp.details.map(det => (
                    <tr key={det.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem' }}>{det.product.name}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{det.actualUsage} {(det.product as any).unitGramasi || det.product.unit}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {det.usedFarmerProduct ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>Produk Petani</span>
                        ) : (
                          <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>Stok Sendiri</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Dokumentasi Foto */}
              {dp.photos && (() => {
                try {
                  const photoUrls: string[] = JSON.parse(dp.photos)
                  if (photoUrls.length === 0) return null
                  return (
                    <div style={{ marginTop: '1rem' }}>
                      <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>📷 Dokumentasi</strong>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`Dokumentasi ${i + 1}`}
                              style={{
                                width: '120px', height: '120px', objectFit: 'cover',
                                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                cursor: 'pointer', transition: 'transform 0.15s',
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                } catch { return null }
              })()}

              {dp.isFinalSession && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#D1FAE5', color: '#065F46', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>
                  ✅ Sesi ini ditandai sebagai sesi terakhir. Demo plot selesai.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
