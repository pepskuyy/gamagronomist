'use client'

import { useState, useCallback, useEffect } from 'react'

type SalesOrder = {
  number: string
  transDate: string      // DD/MM/YYYY from Accurate
  status: string
  customer?: { name?: string, no?: string }
  description: string
  totalAmount: number
  masterSalesman?: { name?: string }
}

type UrgencyLevel = 'terkirim' | 'neutral' | 'warning' | 'danger'

function getUrgency(transDate: string, status: string): UrgencyLevel {
  // Flag processed SOs
  const doneStatuses = ['closed', 'fully processed', 'selesai', 'lunas', 'proceed', 'terkirim']
  if (doneStatuses.some(s => status?.toLowerCase().includes(s))) return 'terkirim'

  // Parse DD/MM/YYYY
  if (!transDate) return 'normal'
  const parts = transDate.split('/')
  if (parts.length !== 3) return 'normal'
  const soDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`)
  const now = new Date()
  const diffMs = now.getTime() - soDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays > 2) return 'danger'
  if (diffDays >= 1) return 'warning'
  return 'neutral'
}

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
}

function formatDate(ddmmyyyy: string) {
  if (!ddmmyyyy) return '-'
  const parts = ddmmyyyy.split('/')
  if (parts.length !== 3) return ddmmyyyy
  const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)
}

function AgeDays({ transDate }: { transDate: string }) {
  const parts = transDate?.split('/')
  if (!parts || parts.length !== 3) return <span>—</span>
  const soDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`)
  const diffMs = Date.now() - soDate.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days === 0) return <span style={{ color: '#059669', fontWeight: 600 }}>{hours}j</span>
  return <span>{days}h {hours}j</span>
}

export default function SoTrackingPage() {
  const defaults = getDefaultDateRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [urgencyFilter, setUrgencyFilter] = useState<'all'|'warning'|'danger'>('all')
  const [expandedNo, setExpandedNo] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  const fetchSO = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/accurate-so?${params}`)
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? 'Gagal mengambil data SO.')
        setOrders([])
      } else {
        setOrders(data.data ?? [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [from, to])

  // Fetch on first render
  useEffect(() => { fetchSO() }, [fetchSO])

  // Derived filters
  const statuses = [...new Set(orders.map(o => o.status).filter(Boolean))]

  const filtered = orders.filter(so => {
    const urgency = getUrgency(so.transDate, so.status)
    if (urgencyFilter !== 'all' && urgency !== urgencyFilter) return false
    if (statusFilter !== 'all' && so.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!so.number?.toLowerCase().includes(q) &&
          !so.customer?.name?.toLowerCase().includes(q) &&
          !so.description?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const terkirimCount = orders.filter(o => getUrgency(o.transDate, o.status) === 'terkirim').length
  const warningCount = orders.filter(o => getUrgency(o.transDate, o.status) === 'warning').length
  const dangerCount = orders.filter(o => getUrgency(o.transDate, o.status) === 'danger').length
  const neutralCount = orders.filter(o => getUrgency(o.transDate, o.status) === 'neutral').length

  const urgencyStyle: Record<UrgencyLevel, React.CSSProperties> = {
    neutral:  {},
    terkirim: { borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.03)' },
    warning:  { borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.04)' },
    danger:   { borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.04)' },
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Tracking Sales Order
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Sinkronasi langsung dari Accurate Online · Hanya menampilkan SO oleh Business Development
        </p>
      </div>

      {/* Summary cards */}
      {fetched && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{orders.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total SO</div>
          </div>
          <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'warning' ? '2px solid #f59e0b' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'warning' ? 'all' : 'warning')}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>{warningCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠️ Perlu Perhatian (1–2 hari)</div>
          </div>
          <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'danger' ? '2px solid #ef4444' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'danger' ? 'all' : 'danger')}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>{dangerCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔴 Terlambat ({'>'}2 hari)</div>
          </div>
          <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'terkirim' ? '2px solid #10b981' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'terkirim' ? 'all' : 'terkirim')}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>{terkirimCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Terkirim / Proceed</div>
          </div>
          <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'neutral' ? '2px solid #94a3b8' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'neutral' ? 'all' : 'neutral')}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#64748b' }}>{neutralCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🆕 Baru</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>DARI TANGGAL</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>SAMPAI TANGGAL</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>
          <button onClick={fetchSO} disabled={loading}
            className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
            {loading ? '⏳ Mengambil...' : '🔄 Sync Accurate'}
          </button>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>CARI</label>
            <input type="text" placeholder="No SO, nama pelanggan..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%' }} />
          </div>
          {statuses.length > 0 && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>STATUS</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                <option value="all">Semua Status</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ color: '#059669' }}>🟩 Terkirim (Proceed / Closed)</span>
        <span>⬜ Baru ({`<`}1 hari)</span>
        <span style={{ color: '#d97706' }}>🟨 Perlu Perhatian (1–2 hari belum diproses)</span>
        <span style={{ color: '#dc2626' }}>🟥 Terlambat ({`>`}2 hari belum diproses)</span>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', marginBottom: '1rem', fontSize: '0.85rem' }}>
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          Mengambil data dari Accurate Online...
        </div>
      )}

      {/* Table */}
      {!loading && fetched && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  {['No SO','Tanggal','Umur','Pelanggan','Keterangan','Status','Total'].map(h => (
                    <th key={h} style={{
                      padding: '0.7rem 1rem', fontSize: '0.72rem', fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap', textAlign: h === 'Total' ? 'right' : 'left'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {orders.length === 0 ? 'Tidak ada SO ditemukan untuk rentang tanggal ini.' : 'Tidak ada SO yang cocok dengan filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((so) => {
                    const urgency = getUrgency(so.transDate, so.status)
                    return (
                        <tr key={so.number}
                          style={{
                            transition: 'background 0.15s',
                            ...urgencyStyle[urgency]
                          }}
                        >
                          <td style={{ padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {urgency === 'danger' && <span style={{ marginRight: '0.35rem' }}>🔴</span>}
                            {urgency === 'warning' && <span style={{ marginRight: '0.35rem' }}>🟡</span>}
                            {urgency === 'terkirim' && <span style={{ marginRight: '0.35rem' }}>🟢</span>}
                            {urgency === 'neutral' && <span style={{ marginRight: '0.35rem' }}>⚪</span>}
                            {so.number}
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.83rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {formatDate(so.transDate)}
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.83rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            <AgeDays transDate={so.transDate} />
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.83rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                            {so.customer?.name || '-'}
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {so.description || '-'}
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border)' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600,
                              background: so.status?.toLowerCase().includes('open') ? '#dbeafe' : '#f1f5f9',
                              color: so.status?.toLowerCase().includes('open') ? '#1d4ed8' : '#64748b',
                            }}>
                              {so.status || '-'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontSize: '0.83rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {so.totalAmount ? formatCurrency(so.totalAmount) : '-'}
                          </td>
                        </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Menampilkan {filtered.length} dari {orders.length} SO</span>
            <span>Sumber: Accurate Online</span>
          </div>
        </div>
      )}
    </div>
  )
}
