'use client'

import { useState } from 'react'
import StockAdjustmentModal from './StockAdjustmentModal'
import { AlertTriangle, ChevronDown, Wrench } from 'lucide-react'

type TeamStockTableProps = {
  users: { id: string, name: string, role: string, parentName?: string }[]
  stocks: { [userId: string]: { product: { id: string, name: string, unit: string, unitGramasi?: string | null, gramasiPerUnit?: number | null }, quantity: number }[] }
  allProducts: { id: string, name: string, unit: string, unitGramasi?: string | null }[]
  role: string // ADMIN, SPV, AFA
  /** Semua akun pemegang stok (bukan hanya halaman ini) — tujuan "Pindah ke akun lain" */
  transferTargets?: { id: string, name: string, role: string }[]
}

const roleBadge: Record<string, { bg: string; text: string }> = {
  AFA: { bg: 'var(--info-bg)', text: 'var(--info)' },
  FO: { bg: 'var(--success-bg)', text: 'var(--success)' },
  INTERN: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
}

export default function TeamStockTable({ users, stocks, allProducts, role, transferTargets = [] }: TeamStockTableProps) {
  const [selectedUser, setSelectedUser] = useState<{ id: string, name: string, role: string, initialProductId?: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {users.map((user) => {
          const showNegative = ['ADMIN', 'SPV'].includes(role)
          const userStocks = (stocks[user.id] || [])
            .filter(s => showNegative ? Math.abs(s.quantity) > 0.0001 : s.quantity > 0)
            .sort((a, b) => (a.quantity < 0 ? -1 : 0) - (b.quantity < 0 ? -1 : 0))
          const positiveStocks = userStocks.filter(s => s.quantity > 0)
          const negativeCount = userStocks.length - positiveStocks.length
          const totalItems = positiveStocks.length
          const isExpanded = expandedId === user.id
          const badge = roleBadge[user.role] || { bg: 'var(--surface-2)', text: 'var(--text-secondary)' }

          return (
            <div 
              key={user.id} 
              className="card" 
              style={{ 
                padding: 0, 
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'var(--transition)',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(isExpanded ? null : user.id)}
            >
              {/* Header */}
              <div style={{ 
                padding: '0.75rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'var(--surface)',
                borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: 500, padding: '0 0.375rem', 
                      borderRadius: 'var(--radius-xs)', background: badge.bg, color: badge.text,
                      flexShrink: 0
                    }}>
                      {user.role}
                    </span>
                    {negativeCount > 0 && (
                      <span title="Ada saldo minus — perlu dicek" style={{
                        fontSize: '0.75rem', fontWeight: 500, padding: '0 0.375rem',
                        borderRadius: 'var(--radius-xs)', background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                        <AlertTriangle size={12} strokeWidth={1.75} /><span className="num">{negativeCount}</span> minus
                      </span>
                    )}
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
                    <div className="num" style={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.2, color: totalItems > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {totalItems}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jenis</div>
                  </div>
                  {/* Expand chevron */}
                  <span style={{ 
                    display: 'inline-flex', color: 'var(--text-muted)', 
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'var(--transition)'
                  }}>
                    <ChevronDown size={16} strokeWidth={1.75} />
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
                  {userStocks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                      Tidak ada stok
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {userStocks.map((s) => {
                        const hasGramasi = s.product.unitGramasi && s.product.gramasiPerUnit && s.product.gramasiPerUnit > 0;
                        const isNegative = s.quantity < 0;
                        return (
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
                            padding: '0.5rem 0.625rem', borderRadius: 'var(--radius-sm)',
                            background: isNegative ? 'var(--danger-bg)' : 'var(--surface-2)', fontSize: '0.8rem',
                            cursor: ['ADMIN', 'SPV'].includes(role) ? 'pointer' : 'default',
                            transition: 'var(--transition)'
                          }}
                        >
                          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{s.product.name}</span>
                          <span style={{ 
                            fontWeight: 600, color: isNegative ? 'var(--danger)' : 'var(--text-main)', 
                            display: 'flex', alignItems: 'baseline', gap: '0.25rem', whiteSpace: 'nowrap'
                          }}>
                            <span className="num">{s.quantity.toLocaleString()}</span>
                            <span className="unit" style={{ marginLeft: 0 }}>{s.product.unitGramasi || s.product.unit}</span>
                            {hasGramasi && (
                              <span className="num" style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                (= {Number.isInteger(s.quantity / (s.product.gramasiPerUnit || 1)) ? s.quantity / (s.product.gramasiPerUnit || 1) : (s.quantity / (s.product.gramasiPerUnit || 1)).toFixed(1)} {s.product.unit})
                              </span>
                            )}
                          </span>
                        </div>
                      )})}
                    </div>
                  )}

                  {/* Adjust button for ADMIN/SPV */}
                  {['ADMIN', 'SPV'].includes(role) && (
                    <button
                      className="btn btn-outline"
                      style={{ width: '100%', marginTop: '0.75rem', padding: '0.375rem', fontSize: '0.8rem' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedUser(user) }}
                    >
                      <Wrench size={14} strokeWidth={1.75} className="icon-inline" />Sesuaikan Stok
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
          balances={(stocks[selectedUser.id] || []).map(s => ({ productId: s.product.id, quantity: s.quantity }))}
          transferTargets={transferTargets}
          onSuccess={() => setSelectedUser(null)}
        />
      )}

      <style jsx>{`
        .card:hover { box-shadow: var(--shadow-md); }
        .stock-row-clickable:hover { background: var(--surface-3) !important; }
      `}</style>
    </>
  )
}
