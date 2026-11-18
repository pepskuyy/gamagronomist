'use client'

import { Fragment, useState } from 'react'
import StockAdjustmentModal from './StockAdjustmentModal'
import { AlertTriangle, ChevronDown, Wrench } from 'lucide-react'

type TeamStockTableProps = {
  users: { id: string, name: string, role: string, areaName: string, afaName: string | null }[]
  stocks: { [userId: string]: { product: { id: string, name: string, code?: string | null, unit: string, unitGramasi?: string | null, gramasiPerUnit?: number | null }, quantity: number }[] }
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

const pill = { fontSize: '0.75rem', fontWeight: 500, padding: '0 0.375rem', borderRadius: 'var(--radius-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' } as const

export default function TeamStockTable({ users, stocks, allProducts, role, transferTargets = [] }: TeamStockTableProps) {
  const [selectedUser, setSelectedUser] = useState<{ id: string, name: string, role: string, initialProductId?: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const canAdjust = ['ADMIN', 'SPV'].includes(role)
  // AFA hanya melihat timnya sendiri, jadi kolom AFA selalu dirinya
  const showAfa = !['AFA', 'PLANTATION'].includes(role)
  const colCount = showAfa ? 6 : 5

  if (users.length === 0) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Tidak ada user ditemukan.</div>
  }

  return (
    <>
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Area</th>
                <th>Role</th>
                {showAfa && <th>AFA</th>}
                <th style={{ textAlign: 'right' }}>Jenis</th>
                <th style={{ width: 40 }} aria-label="Detail" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const userStocks = (stocks[user.id] || [])
                  .filter(s => canAdjust ? Math.abs(s.quantity) > 0.0001 : s.quantity > 0)
                  .sort((a, b) => (a.quantity < 0 ? -1 : 0) - (b.quantity < 0 ? -1 : 0))
                const totalItems = userStocks.filter(s => s.quantity > 0).length
                const negativeCount = userStocks.length - totalItems
                const isExpanded = expandedId === user.id
                const badge = roleBadge[user.role] || { bg: 'var(--surface-2)', text: 'var(--text-secondary)' }
                const toggle = () => setExpandedId(isExpanded ? null : user.id)

                return (
                  <Fragment key={user.id}>
                    <tr
                      className="team-row"
                      onClick={toggle}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                          {user.name}
                          {negativeCount > 0 && (
                            <span title="Ada saldo minus — perlu dicek" style={{ ...pill, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                              <AlertTriangle size={12} strokeWidth={1.75} /><span className="num">{negativeCount}</span> minus
                            </span>
                          )}
                        </span>
                      </td>
                      <td>{user.areaName}</td>
                      <td><span style={{ ...pill, background: badge.bg, color: badge.text }}>{user.role}</span></td>
                      {showAfa && <td style={{ color: user.afaName ? undefined : 'var(--text-muted)' }}>{user.afaName ?? '–'}</td>}
                      <td style={{ textAlign: 'right' }}>
                        <span className="num" style={{ fontWeight: 600, color: totalItems > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{totalItems}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'var(--transition)' }}>
                          <ChevronDown size={16} strokeWidth={1.75} />
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={colCount} style={{ background: 'var(--surface-2)', padding: '0.75rem 1rem' }}>
                          {userStocks.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>Tidak ada stok</div>
                          ) : (
                            <table className="item-table">
                              <thead>
                                <tr><th>Kode SKU</th><th>Produk</th><th style={{ textAlign: 'right' }}>Saldo</th></tr>
                              </thead>
                              <tbody>
                                {userStocks.map((s) => {
                                  const per = s.product.gramasiPerUnit
                                  const hasGramasi = !!(s.product.unitGramasi && per && per > 0)
                                  const packs = hasGramasi ? s.quantity / (per as number) : 0
                                  const isNegative = s.quantity < 0
                                  return (
                                    <tr
                                      key={s.product.id}
                                      className={canAdjust ? 'item-clickable' : undefined}
                                      onClick={canAdjust ? () => setSelectedUser({ ...user, initialProductId: s.product.id }) : undefined}
                                      title={canAdjust ? 'Klik untuk menyesuaikan stok produk ini' : undefined}
                                      style={{ background: isNegative ? 'var(--danger-bg)' : undefined }}
                                    >
                                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono-stack)' }}>{s.product.code || '-'}</td>
                                      <td style={{ fontWeight: 500 }}>{s.product.name}</td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: isNegative ? 'var(--danger)' : 'var(--text-main)' }}>
                                        <span className="num">{s.quantity.toLocaleString('id-ID')}</span>
                                        <span className="unit">{s.product.unitGramasi || s.product.unit}</span>
                                        {hasGramasi && (
                                          <span className="num" style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                                            (= {Number.isInteger(packs) ? packs : packs.toFixed(1)} {s.product.unit})
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                          {canAdjust && (
                            <button className="btn btn-outline" style={{ marginTop: '0.75rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => setSelectedUser(user)}>
                              <Wrench size={14} strokeWidth={1.75} className="icon-inline" />Sesuaikan Stok
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

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
        .team-row:hover td { background: var(--surface-2); }
        .item-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .item-table th { text-align: left; font-weight: 500; color: var(--text-muted); padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--border); }
        .item-table td { padding: 0.5rem; border-bottom: 1px solid var(--border-light); }
        .item-clickable { cursor: pointer; }
        .item-clickable:hover td { background: var(--surface-3); }
      `}</style>
    </>
  )
}
