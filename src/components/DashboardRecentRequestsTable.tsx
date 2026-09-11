'use client'

import { useState } from 'react'
import PaginationBar from './PaginationBar'

export type RecentRequestItem = {
  id: string
  createdAt: Date | string
  status: string
  fo?: { name?: string | null } | null
  farmer?: { name?: string | null } | null
  details: { product: { name: string } }[]
}

interface Props {
  requests: RecentRequestItem[]
}

const PAGE_SIZE = 10

function getStatusBadge(status: string) {
  switch (status) {
    case 'SUBMITTED':
      return <span className="badge badge-warning">Pending</span>
    case 'APPROVED':
      return <span className="badge badge-success">Approved</span>
    case 'REJECTED':
      return <span className="badge badge-danger">Rejected</span>
    case 'DEMO_PLOT_SELESAI':
      return <span className="badge badge-neutral">Selesai</span>
    default:
      return <span className="badge badge-neutral">{status}</span>
  }
}

export default function DashboardRecentRequestsTable({ requests }: Props) {
  const [page, setPage] = useState(1)

  const totalItems = requests.length
  const paginated = requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>🌾 Request Terbaru</h2>
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>FO</th>
                <th>Petani</th>
                <th>Produk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((req) => (
                <tr key={req.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(req.createdAt))}
                  </td>
                  <td>{req.fo?.name || '-'}</td>
                  <td>{req.farmer?.name || '-'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {req.details.map((d) => d.product.name).join(', ')}
                  </td>
                  <td>{getStatusBadge(req.status)}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          currentPage={page}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
