'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, Sprout, FileText, Download, AlertTriangle, ArrowLeft } from 'lucide-react'

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
  { value: 'RECEIVE_FROM_SAMPLE', label: 'Terima dari Gudang Sampel' },
  { value: 'USAGE_DEMOPLOT',    label: 'Pemakaian Demo Plot' },
  { value: 'USAGE_SPOT_DEMOPLOT', label: 'Pemakaian Spot Demplot' },
  { value: 'USAGE_REVERSAL',    label: 'Pembatalan Pemakaian' },
  { value: 'DIRECT_USAGE_AFA',  label: 'Pemakaian Langsung (AFA)' },
  { value: 'ADJUSTMENT_PLUS',   label: 'Koreksi Stok (+)' },
  { value: 'ADJUSTMENT_MINUS',  label: 'Koreksi Stok (-)' },
  { value: 'TRANSFER_ACCOUNT_OUT', label: 'Pindah ke Akun Lain' },
  { value: 'TRANSFER_ACCOUNT_IN',  label: 'Masuk dari Akun Lain' },
  { value: 'ROLLBACK_SAMPLE',   label: 'Rollback Sampel (Reset Admin)' },
]

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    STOCK_IN_GUDANG:  { label: 'Stok Masuk Gudang',       color: 'var(--success)', bg: 'var(--success-bg)' },
    TRANSFER_TO_FO:   { label: 'Transfer ke FO',           color: 'var(--warning)', bg: 'var(--warning-bg)' },
    RECEIVE_FROM_AFA: { label: 'Terima dari AFA',          color: 'var(--info)', bg: 'var(--info-bg)' },
    RECEIVE_FROM_SAMPLE: { label: 'Terima dari Gudang Sampel', color: 'var(--info)', bg: 'var(--info-bg)' },
    USAGE_DEMOPLOT:   { label: 'Pemakaian Demo Plot',      color: 'var(--danger)', bg: 'var(--danger-bg)' },
    USAGE_SPOT_DEMOPLOT: { label: 'Pemakaian Spot Demplot', color: 'var(--danger)', bg: 'var(--danger-bg)' },
    USAGE_REVERSAL:   { label: 'Pembatalan Pemakaian',     color: 'var(--success)', bg: 'var(--success-bg)' },
    DIRECT_USAGE_AFA: { label: 'Pemakaian Langsung',       color: 'var(--danger)', bg: 'var(--danger-bg)' },
    ADJUSTMENT_PLUS:  { label: 'Koreksi Stok (+)',         color: 'var(--success)', bg: 'var(--success-bg)' },
    ADJUSTMENT_MINUS: { label: 'Koreksi Stok (-)',         color: 'var(--danger)', bg: 'var(--danger-bg)' },
    TRANSFER_ACCOUNT_OUT: { label: 'Pindah ke Akun Lain',  color: 'var(--warning)', bg: 'var(--warning-bg)' },
    TRANSFER_ACCOUNT_IN:  { label: 'Masuk dari Akun Lain', color: 'var(--info)', bg: 'var(--info-bg)' },
    ROLLBACK_SAMPLE:  { label: 'Rollback Sampel',          color: 'var(--text-secondary)', bg: 'var(--surface-2)' },
  }
  const m = map[type] || { label: type, color: 'var(--text-secondary)', bg: 'var(--surface-2)' }
  return (
    <span style={{
      padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem',
      fontWeight: 500, color: m.color, background: m.bg, whiteSpace: 'nowrap',
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
  const [subordinates, setSubordinates] = useState<{ id: string; name: string; role: string }[]>([])

  // Filters
  const [filterUserId,  setFilterUserId]  = useState('')
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
    if (filterUserId)  params.set('userId',  filterUserId)
    const res  = await fetch(`/api/ledger?${params}`)
    const data = await res.json()
    setLedgers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterType, filterProduct, filterFrom, filterTo, filterUserId])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch subordinates on mount
  useEffect(() => {
    fetch('/api/users/subordinates')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSubordinates(data)
        }
      })
      .catch(console.error)
  }, [])

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

  // Quick stats — jumlah qty hanya bermakna untuk SATU produk (produk lain bisa ml, gr, atau PCS)
  const singleProduct = !!filterProduct && ledgers.length > 0
  const statUnit = singleProduct ? (ledgers[0].product.unitGramasi || ledgers[0].product.unit) : ''
  const totalIn  = ledgers.filter(l => l.quantity > 0).reduce((s, l) => s + l.quantity, 0)
  const totalOut = ledgers.filter(l => l.quantity < 0).reduce((s, l) => s + l.quantity, 0)
  const demoplotUsage = ledgers
    .filter(l => ['USAGE_DEMOPLOT', 'DIRECT_USAGE_AFA', 'USAGE_SPOT_DEMOPLOT'].includes(l.transactionType))
    .reduce((s, l) => s + Math.abs(l.quantity), 0)
  const fmtStat = (v: number, sign = '') => (singleProduct ? `${sign}${v.toLocaleString('id-ID')} ${statUnit}` : 'Pilih 1 produk')

  // Export to Excel
  async function handleExport() {
    const XLSX = await import('xlsx') // lazy-load
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
    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.875rem', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums'
  }

  return (
    <div>
      {/* Header */}
      <div className="back-header" style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><ArrowLeft size={16} strokeWidth={1.75} className="icon-inline" />Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Histori Transaksi &amp; Pemakaian Stok</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Semua transaksi stok termasuk penerimaan, transfer, dan pemakaian demo plot
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Masuk', value: fmtStat(totalIn, '+'), color: 'var(--success)', icon: <ArrowUp size={16} strokeWidth={1.75} /> },
          { label: 'Total Keluar', value: fmtStat(totalOut), color: 'var(--danger)', icon: <ArrowDown size={16} strokeWidth={1.75} /> },
          { label: 'Pemakaian Demo Plot', value: fmtStat(demoplotUsage), color: 'var(--text-main)', icon: <Sprout size={16} strokeWidth={1.75} /> },
          { label: 'Total Transaksi', value: ledgers.length.toString(), color: 'var(--text-main)', icon: <FileText size={16} strokeWidth={1.75} /> },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.5rem' }}>{s.icon}{s.label}</div>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
          {/* User Filter (For AFA/ADMIN) */}
          {subordinates.length > 0 && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Akun</label>
              <select className="form-control" value={filterUserId} onChange={e => setFilterUserId(e.target.value)}>
                <option value="">Stok Sendiri</option>
                {subordinates.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          )}
          {/* Date From */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Dari</label>
            <input type="date" className="form-control" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          {/* Date To */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Sampai</label>
            <input type="date" className="form-control" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {/* Type Filter */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Jenis</label>
            <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
              {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Product Filter */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Produk</label>
            <select className="form-control" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
              <option value="">Semua Produk</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button className="btn btn-outline" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => {
              setFilterType(''); setFilterProduct(''); setFilterFrom(oneMonth); setFilterTo(today); setFilterUserId('');
            }}>Reset</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, whiteSpace: 'nowrap' }}
              onClick={handleExport}
              disabled={ledgers.length === 0}
            >
              <Download size={16} strokeWidth={1.75} className="icon-inline" />Excel
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong className="num" style={{ fontWeight: 600 }}>{ledgers.length}</strong> transaksi
          </span>
          {ledgers.length === 1000 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={14} strokeWidth={1.75} className="icon-inline" />Hasil dibatasi 1.000 baris — gunakan filter tanggal untuk mempersempit
            </span>
          )}
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Tanggal', 'Jenis Transaksi', 'Produk', 'Stok Awal', 'Kuantitas', 'Stok Akhir', 'Catatan'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
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
                    ...tdStyle, fontSize: '0.8rem',
                    color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap'
                  }

                  return (
                    <tr key={item.id} style={{ transition: 'var(--transition)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}
                      </td>
                      <td style={tdStyle}>
                        <TypeBadge type={item.transactionType} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-main)' }}>
                        {item.product.name}
                      </td>
                      {/* Stok Awal */}
                      <td style={balanceTdStyle}>
                        {item.stockBefore !== null ? <><span className="num">{item.stockBefore}</span><span className="unit">{unit}</span></> : '–'}
                      </td>
                      {/* Kuantitas */}
                      <td style={tdStyle}>
                        <span style={{
                          color: isOut ? 'var(--danger)' : 'var(--success)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem'
                        }}>
                          <span style={{ alignSelf: 'center', display: 'inline-flex' }}>{isOut ? <ArrowDown size={14} strokeWidth={1.75} /> : <ArrowUp size={14} strokeWidth={1.75} />}</span>
                          <span className="num">{isOut ? '' : '+'}{item.quantity}</span>
                          <span className="unit" style={{ marginLeft: 0 }}>{unit}</span>
                        </span>
                      </td>
                      {/* Stok Akhir */}
                      <td style={{ ...balanceTdStyle, fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.stockAfter !== null ? <><span className="num">{item.stockAfter}</span><span className="unit">{unit}</span></> : '–'}
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
