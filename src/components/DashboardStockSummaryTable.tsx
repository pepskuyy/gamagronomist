'use client'

import { useState } from 'react'
import PaginationBar from './PaginationBar'

export type StockSummaryItem = {
  userName: string
  role: string
  productName: string
  unit: string
  balance: number
}

interface Props {
  items: StockSummaryItem[]
}

const PAGE_SIZE = 10

export default function DashboardStockSummaryTable({ items }: Props) {
  const [page, setPage] = useState(1)

  if (!items || items.length === 0) return null

  const totalItems = items.length
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>📦 Saldo Stok Per User</h2>
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Produk</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{s.userName}</td>
                  <td>
                    <span className={`badge ${['AFA', 'PLANTATION'].includes(s.role) ? 'badge-success' : 'badge-neutral'}`}>
                      {s.role}
                    </span>
                  </td>
                  <td>{s.productName}</td>
                  <td style={{ fontWeight: 700, color: s.balance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {s.balance} {s.unit}
                  </td>
                </tr>
              ))}
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
