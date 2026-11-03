'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Loader2, XCircle } from 'lucide-react'

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
  if (days === 0) return <span className="num" style={{ color: 'var(--success)', fontWeight: 500 }}>{hours}j</span>
  return <span className="num">{days}h {hours}j</span>
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
    terkirim: { boxShadow: 'inset 3px 0 0 var(--success)' },
    warning:  { boxShadow: 'inset 3px 0 0 var(--warning)', background: 'var(--warning-bg)' },
    danger:   { boxShadow: 'inset 3px 0 0 var(--danger)', background: 'var(--danger-bg)' },
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Tracking Sales Order
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Sinkronasi langsung dari Accurate Online · Hanya menampilkan SO oleh Business Development
        </p>
      </div>

      {/* Summary cards */}
      {fetched && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{orders.length}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total SO</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'warning' ? '1px solid var(--warning)' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'warning' ? 'all' : 'warning')}>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>{warningCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Perlu Perhatian (1–2 hari)</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'danger' ? '1px solid var(--danger)' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'danger' ? 'all' : 'danger')}>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--danger)' }}>{dangerCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Terlambat ({'>'}2 hari)</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'terkirim' ? '1px solid var(--success)' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'terkirim' ? 'all' : 'terkirim')}>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>{terkirimCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Terkirim / Proceed</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', border: urgencyFilter === 'neutral' ? '1px solid var(--text-muted)' : undefined }}
            onClick={() => setUrgencyFilter(urgencyFilter === 'neutral' ? 'all' : 'neutral')}>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>{neutralCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Baru</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Dari tanggal</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Sampai tanggal</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
          </div>
          <button onClick={fetchSO} disabled={loading}
            className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
            {loading ? <><Loader2 size={16} strokeWidth={1.75} className="icon-inline" style={{ animation: 'spin 0.8s linear infinite' }} /> Mengambil...</> : <><RefreshCw size={16} strokeWidth={1.75} className="icon-inline" /> Sync Accurate</>}
          </button>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Cari</label>
            <input type="text" placeholder="No SO, nama pelanggan..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }} />
          </div>
          {statuses.length > 0 && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                <option value="all">Semua Status</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Terkirim (Proceed / Closed)</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Baru ({`<`}1 hari)</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Perlu Perhatian (1–2 hari belum diproses)</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginRight: '0.375rem', verticalAlign: 'middle' }} />Terlambat ({`>`}2 hari belum diproses)</span>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: '1rem', background: 'var(--danger-bg)', border: '1px solid var(--border)', color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <XCircle size={16} strokeWidth={1.75} className="icon-inline" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={20} strokeWidth={1.75} style={{ marginBottom: '0.5rem', animation: 'spin 0.8s linear infinite' }} />
          <div>Mengambil data</div> dari Accurate Online...
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
                      padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500,
                      color: 'var(--text-muted)',
                      background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap', textAlign: h === 'Total' ? 'right' : 'left'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {orders.length === 0 ? 'Tidak ada SO ditemukan untuk rentang tanggal ini.' : 'Tidak ada SO yang cocok dengan filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((so) => {
                    const urgency = getUrgency(so.transDate, so.status)
                    return (
                        <tr key={so.number}
                          style={{
                            transition: 'var(--transition)',
                            ...urgencyStyle[urgency]
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono-stack)', fontSize: '0.82rem', fontWeight: 500, borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                            {urgency === 'danger' && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                            {urgency === 'warning' && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                            {urgency === 'terkirim' && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                            {urgency === 'neutral' && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                            {so.number}
                          </td>
                          <td className="num" style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                            {formatDate(so.transDate)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                            <AgeDays transDate={so.transDate} />
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', fontWeight: 500 }}>
                            {so.customer?.name || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {so.description || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{
                              padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 500,
                              background: so.status?.toLowerCase().includes('open') ? 'var(--info-bg)' : 'var(--surface-2)',
                              color: so.status?.toLowerCase().includes('open') ? 'var(--info)' : 'var(--text-muted)',
                            }}>
                              {so.status || '-'}
                            </span>
                          </td>
                          <td className="num" style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {so.totalAmount ? formatCurrency(so.totalAmount) : '-'}
                          </td>
                        </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Menampilkan <span className="num">{filtered.length}</span> dari <span className="num">{orders.length}</span> SO</span>
            <span>Sumber: Accurate Online</span>
          </div>
        </div>
      )}
    </div>
  )
}
