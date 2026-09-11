'use client'

import { useState } from 'react'
import PaginationBar from './PaginationBar'

export type RecentLedgerItem = {
  id: string
  createdAt: Date | string
  transactionType: string
  quantity: number
  product: {
    name: string
    unit: string
  }
  user: {
    name: string
  }
}

interface Props {
  ledgers: RecentLedgerItem[]
  isSPV: boolean
}

const PAGE_SIZE = 10

function formatType(type: string) {
  const map: Record<string, { label: string; cls: string }> = {
    STOCK_IN_GUDANG: { label: 'Stok Masuk', cls: 'badge-success' },
    TRANSFER_TO_FO: { label: 'Transfer ke FO', cls: 'badge-warning' },
    RECEIVE_FROM_AFA: { label: 'Terima AFA', cls: 'badge-success' },
    USAGE_DEMOPLOT: { label: 'Pemakaian', cls: 'badge-danger' },
    DIRECT_USAGE_AFA: { label: 'Pakai Langsung', cls: 'badge-danger' },
    ADJUSTMENT_PLUS: { label: 'Adj (+)', cls: 'badge-success' },
    ADJUSTMENT_MINUS: { label: 'Adj (-)', cls: 'badge-danger' },
  }
  const m = map[type] || { label: type, cls: 'badge-neutral' }
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export default function DashboardRecentLedgersTable({ ledgers, isSPV }: Props) {
  const [page, setPage] = useState(1)

  const totalItems = ledgers.length
  const paginated = ledgers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>🕒 Aktivitas Stok Terbaru</h2>
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                {isSPV && <th>User</th>}
                <th>Tipe</th>
                <th>Produk</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(l.createdAt)
                    )}
                  </td>
                  {isSPV && <td style={{ fontWeight: 500 }}>{l.user.name}</td>}
                  <td>{formatType(l.transactionType)}</td>
                  <td>{l.product.name}</td>
                  <td style={{ fontWeight: 700, color: l.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {l.quantity > 0 ? '+' : ''}
                    {l.quantity} {l.product.unit}
                  </td>
                </tr>
              ))}
              {ledgers.length === 0 && (
                <tr>
                  <td colSpan={isSPV ? 5 : 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada transaksi.
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
