'use client'

import { useState } from 'react'
import StockAdjustmentModal from './StockAdjustmentModal'

type TeamStockTableProps = {
  users: { id: string, name: string, role: string, parentName?: string }[]
  stocks: { [userId: string]: { product: { id: string, name: string, unit: string, unitGramasi?: string | null }, quantity: number }[] }
  allProducts: { id: string, name: string, unit: string, unitGramasi?: string | null }[]
  role: string // ADMIN, SPV, AFA
}

const roleBadge: Record<string, { bg: string; text: string }> = {
  AFA: { bg: '#dbeafe', text: '#1d4ed8' },
  FO: { bg: '#dcfce7', text: '#166534' },
  INTERN: { bg: '#fef3c7', text: '#92400e' },
}

export default function TeamStockTable({ users, stocks, allProducts, role }: TeamStockTableProps) {
  const [selectedUser, setSelectedUser] = useState<{ id: string, name: string, role: string, initialProductId?: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {users.map((user) => {
          const userStocks = (stocks[user.id] || []).filter(s => s.quantity > 0)
          const totalItems = userStocks.length
          const totalQty = userStocks.reduce((sum, s) => sum + s.quantity, 0)
          const isExpanded = expandedId === user.id
          const badge = roleBadge[user.role] || { bg: '#f1f5f9', text: '#475569' }

          return (
            <div 
              key={user.id} 
              className="card" 
              style={{ 
                padding: 0, 
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(isExpanded ? null : user.id)}
            >
              {/* Header */}
              <div style={{ 
                padding: '0.85rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'var(--surface)',
                borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </span>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', 
                      borderRadius: '9999px', background: badge.bg, color: badge.text,
                      flexShrink: 0
                    }}>
                      {user.role}
                    </span>
                  </div>
                  {!['AFA', 'PLANTATION'].includes(role) && user.parentName && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {user.parentName}
                    </div>
                  )}
                </div>

                {/* Summary stats */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: totalQty > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {totalQty > 0 ? totalQty.toLocaleString() : '0'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: totalItems > 0 ? '#059669' : 'var(--text-muted)' }}>
                      {totalItems}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jenis</div>
                  </div>
                  {/* Expand chevron */}
                  <span style={{ 
                    fontSize: '0.8rem', color: 'var(--text-muted)', 
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '0.6rem 1rem 0.85rem' }}>
                  {userStocks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                      Tidak ada stok
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {userStocks.map((s) => (
                        <div 
                          key={s.product.id}
                          className={['ADMIN', 'SPV'].includes(role) ? "stock-row-clickable" : ""}
                          onClick={(e) => {
                            if (['ADMIN', 'SPV'].includes(role)) {
                              e.stopPropagation();
                              setSelectedUser({ ...user, initialProductId: s.product.id });
                            }
                          }}
                          style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.45rem 0.6rem', borderRadius: 'var(--radius)',
                            background: 'var(--surface-2)', fontSize: '0.82rem',
                            cursor: ['ADMIN', 'SPV'].includes(role) ? 'pointer' : 'default',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{s.product.name}</span>
                          <span style={{ 
                            fontWeight: 700, color: 'var(--primary)', 
                            display: 'flex', alignItems: 'baseline', gap: '0.25rem'
                          }}>
                            {s.quantity.toLocaleString()}
                            <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>{s.product.unitGramasi || s.product.unit}</span>
                            {hasGramasi && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                (= {Number.isInteger(s.quantity / (s.product.gramasiPerUnit || 1)) ? s.quantity / (s.product.gramasiPerUnit || 1) : (s.quantity / (s.product.gramasiPerUnit || 1)).toFixed(1)} {s.product.unit})
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adjust button for ADMIN/SPV */}
                  {['ADMIN', 'SPV'].includes(role) && (
                    <button
                      className="btn btn-outline"
                      style={{ width: '100%', marginTop: '0.65rem', padding: '0.4rem', fontSize: '0.78rem' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedUser(user) }}
                    >
                      🛠️ Sesuaikan Stok
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {users.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          Tidak ada user ditemukan.
        </div>
      )}

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
        .card:hover { box-shadow: 0 2px 8px rgb(0 0 0 / 0.08); transform: translateY(-1px); }
        .stock-row-clickable:hover { background: var(--surface-3) !important; filter: brightness(0.95); }
      `}</style>
    </>
  )
}
