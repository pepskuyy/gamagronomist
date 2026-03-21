'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveAfaStockRequest } from '@/app/actions/afa-stock'

type RequestProps = {
  id: string
  createdAt: Date
  status: string
  plan: string | null
  foId: string
  fo?: { id: string; name: string } | null
  afaId?: string | null
  afa?: { id: string; name: string } | null
  details: { 
    id: string
    qtyRequested: number
    qtyApproved: number | null
    product: { id: string; name: string; unit: string }
  }[]
}

export default function AfaStockRequestTable({
  requests,
  role
}: {
  requests: RequestProps[]
  role: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  const handleApprove = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menyetujui pengajuan stok ini? Stok akan langsung ditambahkan ke ledger AFA.')) return
    setActionId(id)
    startTransition(async () => {
      const res = await approveAfaStockRequest(id)
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActionId(null)
    })
  }

  const handleDownloadPdf = async (req: RequestProps) => {
    try {
      const { default: jsPDF } = await import('jspdf')
      await import('jspdf-autotable')

      const doc = new jsPDF()

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('BUKTI PENERIMAAN STOK (AFA)', 14, 20)

      // Form Details
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`ID Referensi : ${req.id.toUpperCase()}`, 14, 32)
      doc.text(`Tanggal         : ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(req.createdAt))}`, 14, 38)
      doc.text(`AFA Pemohon: ${req.fo?.name || 'Tidak diketahui'}`, 14, 44)
      doc.text(`Disetujui Oleh : ${req.afa?.name || 'SPV'}`, 14, 50)
      doc.text(`Keterangan    : ${req.plan || '-'}`, 14, 56)

      // Table Data
      const tableBody = req.details.map((d, index) => [
        index + 1,
        d.product.name,
        d.qtyRequested,
        d.qtyApproved || d.qtyRequested,
        d.product.unit
      ])

      // @ts-ignore
      doc.autoTable({
        startY: 65,
        head: [['No', 'Produk', 'Qty Diminta', 'Qty Disetujui', 'Satuan']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 65
      doc.text('Dokumen ini dibuat secara otomatis oleh sistem Gamagronomist dan sah tanpa tanda tangan fisik.', 14, finalY + 20)

      doc.save(`Bukti_Stok_${req.id.slice(0, 8).toUpperCase()}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      alert('Gagal mengunduh dokumen PDF. Silakan coba lagi.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':        return <span className="badge badge-warning">Menunggu SPV</span>
      case 'APPROVED':         return <span className="badge badge-success">Selesai</span>
      case 'REJECTED':         return <span className="badge badge-danger">Ditolak</span>
      default:                 return <span className="badge badge-neutral">{status}</span>
    }
  }

  if (requests.length === 0) return null

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        📨 Pengajuan Stok {role === 'SPV' ? 'dari AFA' : 'Saya'}
      </h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>ID</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tanggal</th>
                {role === 'SPV' && <th style={{ ...thStyle, textAlign: 'left' }}>Nama AFA</th>}
                <th style={{ ...thStyle, textAlign: 'left' }}>Produk Diminta</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{req.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}</td>
                  {role === 'SPV' && <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{req.fo?.name}</td>}
                  <td style={{ ...tdStyle, fontSize: '0.82rem' }}>
                    {req.details.map(d => `${d.product.name}: ${d.qtyRequested} ${d.product.unit}`).join(', ')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{getStatusBadge(req.status)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div className="action-row" style={{ justifyContent: 'center' }}>
                      {role === 'SPV' && req.status === 'SUBMITTED' && (
                        <button 
                          onClick={() => handleApprove(req.id)}
                          className="btn btn-primary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          disabled={isPending && actionId === req.id}
                        >
                          {isPending && actionId === req.id ? 'Memproses...' : 'Approve Stok'}
                        </button>
                      )}
                      
                      {req.status === 'APPROVED' && (
                        <button 
                          onClick={() => handleDownloadPdf(req)}
                          className="btn btn-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#0ea5e9', borderColor: '#e0f2fe' }}
                        >
                          📄 Download PDF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
