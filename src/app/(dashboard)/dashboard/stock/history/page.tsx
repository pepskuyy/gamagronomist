'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type LedgerItem = {
  id: string
  transactionType: string
  quantity: number
  notes: string | null
  referenceId: string | null
  createdAt: string
  stockBefore: number | null
  stockAfter: number | null
  product: { id: string; name: string; unit: string; unitGramasi?: string | null }
}

const TRANSACTION_TYPES = [
  { value: '',                  label: 'Semua Jenis' },
  { value: 'STOCK_IN_GUDANG',   label: 'Stok Masuk Gudang' },
  { value: 'TRANSFER_TO_FO',    label: 'Transfer Keluar ke FO' },
  { value: 'RECEIVE_FROM_AFA',  label: 'Terima dari AFA' },
  { value: 'USAGE_DEMOPLOT',    label: 'Pemakaian Demo Plot' },
  { value: 'DIRECT_USAGE_AFA',  label: 'Pemakaian Langsung (AFA)' },
  { value: 'ADJUSTMENT_PLUS',   label: 'Koreksi Stok (+)' },
  { value: 'ADJUSTMENT_MINUS',  label: 'Koreksi Stok (-)' },
]

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    STOCK_IN_GUDANG:  { label: 'Stok Masuk Gudang',       color: '#166534', bg: '#dcfce7' },
    TRANSFER_TO_FO:   { label: 'Transfer ke FO',           color: '#92400e', bg: '#fef3c7' },
    RECEIVE_FROM_AFA: { label: 'Terima dari AFA',          color: '#1e40af', bg: '#dbeafe' },
    USAGE_DEMOPLOT:   { label: 'Pemakaian Demo Plot',      color: '#991b1b', bg: '#fee2e2' },
    DIRECT_USAGE_AFA: { label: 'Pemakaian Langsung',       color: '#7c3aed', bg: '#ede9fe' },
    ADJUSTMENT_PLUS:  { label: 'Koreksi Stok (+)',         color: '#065f46', bg: '#d1fae5' },
    ADJUSTMENT_MINUS: { label: 'Koreksi Stok (-)',         color: '#9f1239', bg: '#fce7f3' },
  }
  const m = map[type] || { label: type, color: '#4b5563', bg: '#f3f4f6' }
  return (
    <span style={{
      padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.72rem',
      fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

const today    = new Date().toISOString().split('T')[0]
const oneMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

export default function LedgerHistoryPage() {
  const [ledgers,  setLedgers]  = useState<LedgerItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])

  // Filters
  const [filterType,    setFilterType]    = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterFrom,    setFilterFrom]    = useState(oneMonth)
  const [filterTo,      setFilterTo]      = useState(today)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType)    params.set('type',    filterType)
    if (filterProduct) params.set('product', filterProduct)
    if (filterFrom)    params.set('from',    filterFrom)
    if (filterTo)      params.set('to',      filterTo)
    const res  = await fetch(`/api/ledger?${params}`)
    const data = await res.json()
    setLedgers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterType, filterProduct, filterFrom, filterTo])

  useEffect(() => { fetchData() }, [fetchData])

  // Build unique product list from ledgers for filter dropdown
  useEffect(() => {
    const seen = new Set<string>()
    const list: { id: string; name: string }[] = []
    ledgers.forEach(l => {
      if (!seen.has(l.product.id)) {
        seen.add(l.product.id)
        list.push({ id: l.product.id, name: l.product.name })
      }
    })
    // Keep existing if ledgers empty
    if (list.length > 0) setProducts(list)
  }, [ledgers])

  // Quick stats
  const totalIn  = ledgers.filter(l => l.quantity > 0).reduce((s, l) => s + l.quantity, 0)
  const totalOut = ledgers.filter(l => l.quantity < 0).reduce((s, l) => s + l.quantity, 0)
  const demoplotUsage = ledgers
    .filter(l => l.transactionType === 'USAGE_DEMOPLOT' || l.transactionType === 'DIRECT_USAGE_AFA')
    .reduce((s, l) => s + Math.abs(l.quantity), 0)

  // Export to Excel
  function handleExport() {
    const rows = ledgers.map(item => {
      const unit = item.product.unitGramasi || item.product.unit
      return {
        'Tanggal'          : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt)),
        'Jenis Transaksi'  : TRANSACTION_TYPES.find(t => t.value === item.transactionType)?.label || item.transactionType,
        'Produk'           : item.product.name,
        'Stok Awal'        : item.stockBefore ?? '-',
        'Kuantitas'        : item.quantity,
        'Stok Akhir'       : item.stockAfter ?? '-',
        'Satuan'           : unit,
        'Masuk/Keluar'     : item.quantity > 0 ? 'Masuk' : 'Keluar',
        'Ref ID'           : item.referenceId || '-',
        'Catatan'          : item.notes || '-',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key]).length))
    }))
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Histori Ledger')
    const filename = `histori-ledger-${filterFrom}-sd-${filterTo}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle'
  }

  return (
    <div>
      {/* Header */}
      <div className="back-header" style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>📋 Histori Transaksi &amp; Pemakaian Stok</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Semua transaksi stok termasuk penerimaan, transfer, dan pemakaian demo plot
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Masuk', value: `+${totalIn.toLocaleString()}`, color: '#16a34a', icon: '⬆️' },
          { label: 'Total Keluar', value: totalOut.toLocaleString(), color: '#dc2626', icon: '⬇️' },
          { label: 'Pemakaian Demo Plot', value: demoplotUsage.toLocaleString(), color: '#7c3aed', icon: '🌾' },
          { label: 'Total Transaksi', value: ledgers.length.toString(), color: 'var(--primary)', icon: '📄' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
          {/* Date From */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dari</label>
            <input type="date" className="form-control" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          {/* Date To */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sampai</label>
            <input type="date" className="form-control" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {/* Type Filter */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jenis</label>
            <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
              {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Product Filter */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Produk</label>
            <select className="form-control" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
              <option value="">Semua Produk</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button className="btn btn-outline" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => {
              setFilterType(''); setFilterProduct(''); setFilterFrom(oneMonth); setFilterTo(today)
            }}>Reset</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, whiteSpace: 'nowrap' }}
              onClick={handleExport}
              disabled={ledgers.length === 0}
            >
              📥 Excel
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong>{ledgers.length}</strong> transaksi
          </span>
          {ledgers.length === 1000 && (
            <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
              ⚠️ Hasil dibatasi 1.000 baris — gunakan filter tanggal untuk mempersempit
            </span>
          )}
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Tanggal', 'Jenis Transaksi', 'Produk', 'Stok Awal', 'Kuantitas', 'Stok Akhir', 'Catatan'].map(h => (
                  <th key={h} style={{ padding: '0.7rem 1rem', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                    Memuat data...
                  </td>
                </tr>
              ) : ledgers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Tidak ada transaksi ditemukan sesuai filter.
                  </td>
                </tr>
              ) : (
                ledgers.map((item) => {
                  const isOut = item.quantity < 0
                  const unit  = item.product.unitGramasi || item.product.unit

                  const balanceTdStyle: React.CSSProperties = {
                    ...tdStyle, fontFamily: 'monospace', fontSize: '0.82rem',
                    color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap'
                  }

                  return (
                    <tr key={item.id} style={{ transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.83rem' }}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}
                      </td>
                      <td style={tdStyle}>
                        <TypeBadge type={item.transactionType} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>
                        {item.product.name}
                      </td>
                      {/* Stok Awal */}
                      <td style={balanceTdStyle}>
                        {item.stockBefore !== null ? `${item.stockBefore} ${unit}` : '–'}
                      </td>
                      {/* Kuantitas */}
                      <td style={tdStyle}>
                        <span style={{
                          color: isOut ? '#dc2626' : '#16a34a',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          display: 'inline-flex', alignItems: 'baseline', gap: '0.2rem'
                        }}>
                          <span>{isOut ? '▼' : '▲'}</span>
                          <span>{isOut ? '' : '+'}{item.quantity}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
                        </span>
                      </td>
                      {/* Stok Akhir */}
                      <td style={{ ...balanceTdStyle, fontWeight: 700, color: isOut ? '#dc2626' : '#16a34a' }}>
                        {item.stockAfter !== null ? `${item.stockAfter} ${unit}` : '–'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.notes || '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
