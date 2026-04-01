'use client'

import { useState } from 'react'
import StockAdjustmentModal from './StockAdjustmentModal'

type TeamStockTableProps = {
  users: { id: string, name: string, role: string, parentName?: string }[]
  stocks: { [userId: string]: { product: { id: string, name: string, unit: string }, quantity: number }[] }
  allProducts: { id: string, name: string, unit: string }[]
  role: string // ADMIN, SPV, AFA
}

export default function TeamStockTable({ users, stocks, allProducts, role }: TeamStockTableProps) {
  const [selectedUser, setSelectedUser] = useState<{ id: string, name: string, role: string } | null>(null)

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>Nama User</th>
              {role !== 'AFA' && <th style={{ ...thStyle, textAlign: 'left' }}>AFA / Area</th>}
              {allProducts.map(p => (
                <th key={p.id} style={{ ...thStyle, textAlign: 'right' }}>
                  {p.name}
                  <span style={{ display: 'block', fontWeight: 400, textTransform: 'lowercase', letterSpacing: 0 }}>({p.unit})</span>
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right' }}>Total Item</th>
              {['ADMIN', 'SPV'].includes(role) && (
                <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const userStocks = stocks[user.id] || []
              const totalQty = userStocks.reduce((sum, s) => sum + s.quantity, 0)
              
              return (
                <tr key={user.id} className="fo-stock-row hover-bg">
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.role}</div>
                  </td>
                  {role !== 'AFA' && (
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {user.parentName || '-'}
                    </td>
                  )}
                  {allProducts.map(p => {
                    const s = userStocks.find(st => st.product.id === p.id)
                    const qty = s?.quantity ?? 0
                    return (
                      <td key={p.id} style={{ ...tdStyle, textAlign: 'right', fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {qty !== 0 ? qty.toLocaleString() : '—'}
                      </td>
                    )
                  })}
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                    <span style={{ background: totalQty !== 0 ? 'var(--primary-light)' : 'var(--surface-2)', color: totalQty !== 0 ? 'var(--primary)' : 'var(--text-muted)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.82rem' }}>
                      {totalQty !== 0 ? totalQty.toLocaleString() : '0'}
                    </span>
                  </td>
                  {['ADMIN', 'SPV'].includes(role) && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => setSelectedUser(user)}
                      >
                        🛠️ Sesuaikan
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <StockAdjustmentModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          products={allProducts}
          onSuccess={() => setSelectedUser(null)}
        />
      )}

      <style jsx>{`
        .hover-bg:hover { background: var(--surface-hover); }
      `}</style>
    </div>
  )
}
