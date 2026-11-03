'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { RefreshCw, Package, Sprout, RotateCw, X, ClipboardList, ArrowLeft, ArrowRight } from 'lucide-react'

interface SyncLogItem {
  id: string
  dataType: string
  triggerType: 'MANUAL' | 'OTOMATIS'
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  processedCount: number
  message: string | null
  errorDetail: string | null
  durationMs: number | null
  startedAt: string
  finishedAt: string | null
}

interface SyncSummary {
  totalRuns: number
  successCount: number
  failedCount: number
  runningCount: number
  lastRun: string | null
}

interface Props {
  userRole: string
}

export default function SyncMonitorClient({ userRole }: Props) {
  const [logs, setLogs] = useState<SyncLogItem[]>([])
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Trigger state
  const [isTriggering, startTrigger] = useTransition()
  const [triggerMsg, setTriggerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchLogs = useCallback((p = page, status = statusFilter, type = typeFilter) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('limit', '30')
    if (status) params.set('status', status)
    if (type) params.set('type', type)

    fetch(`/api/admin/sync-monitor?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal mengambil data monitoring.')
        return res.json()
      })
      .then((data) => {
        setLogs(data.logs || [])
        setSummary(data.summary || null)
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.total || 0)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching sync logs:', err)
        setLoading(false)
      })
  }, [page, statusFilter, typeFilter])

  useEffect(() => {
    fetchLogs(1, statusFilter, typeFilter)
  }, [statusFilter, typeFilter, fetchLogs])

  // Trigger manual sync
  const handleTriggerSync = (syncType: string, label: string) => {
    if (!confirm(`Jalankan sinkronisasi "${label}" sekarang secara manual?`)) return

    setTriggerMsg(null)
    startTrigger(async () => {
      try {
        const res = await fetch('/api/admin/sync-monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: syncType }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menjalankan sinkronisasi.')

        setTriggerMsg({
          type: 'success',
          text: `Sinkronisasi "${label}" selesai diproses!`,
        })
        fetchLogs(1, statusFilter, typeFilter)
      } catch (err: any) {
        setTriggerMsg({
          type: 'error',
          text: `Gagal memicu sinkronisasi: ${err.message}`,
        })
      }
    })
  }

  // Format tanggal ke format WIB seperti di gambar: DD/MM/YYYY, HH.mm.ss
  const formatWibDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d).replace(/\//g, '/').replace(/:/g, '.')
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Monitoring Sinkronisasi Data
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
            >
              Khusus Admin
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Riwayat log otomatis dan manual sinkronisasi data Sales Dashboard, Accurate Online, dan SIMOTANDI
          </p>
        </div>

        {/* Manual Trigger Buttons Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleTriggerSync('all-sales', 'Sales Dashboard (Toko & Faktur)')}
            disabled={isTriggering}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
            }}
          >
            <RefreshCw size={16} strokeWidth={1.75} className="icon-inline" />
            <span>Sync Sales Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSync('accurate', 'Accurate Barang & Stok')}
            disabled={isTriggering}
            className="btn btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
            }}
          >
            <Package size={16} strokeWidth={1.75} className="icon-inline" />
            <span>Sync Accurate</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSync('simotandi', 'SIMOTANDI Fase Padi')}
            disabled={isTriggering}
            className="btn btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
            }}
          >
            <Sprout size={16} strokeWidth={1.75} className="icon-inline" />
            <span>Sync SIMOTANDI</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(page, statusFilter, typeFilter)}
            title="Muat Ulang Log"
            className="btn btn-outline"
            style={{
              padding: '0.5rem 0.625rem',
              fontSize: '0.875rem',
            }}
          >
            <RotateCw size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Trigger Feedback Alert */}
      {triggerMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            background: triggerMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: triggerMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: '1px solid var(--border)',
          }}
        >
          {triggerMsg.text}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Sinkronisasi Tercatat</div>
          <div className="num" style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {summary?.totalRuns || totalCount}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
              eksekusi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Berhasil</div>
          <div className="num" style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--success)', marginTop: '0.25rem' }}>
            {summary?.successCount || 0}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
              sesi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Gagal / Kendala</div>
          <div className="num" style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--danger)', marginTop: '0.25rem' }}>
            {summary?.failedCount || 0}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
              sesi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Terakhir Dijalankan</div>
          <div className="num" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {summary?.lastRun ? formatWibDate(summary.lastRun) : '-'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Filter Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.375rem 0.625rem',
                fontSize: '0.78rem',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <option value="">Semua Status</option>
              <option value="SUCCESS">Berhasil</option>
              <option value="FAILED">Gagal</option>
              <option value="RUNNING">Sedang Berjalan</option>
            </select>
          </div>

          {/* Filter Tipe Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Tipe Data:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.375rem 0.625rem',
                fontSize: '0.78rem',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <option value="">Semua Tipe Data</option>
              <option value="Transaksi SO">Transaksi SO & Invoice</option>
              <option value="Pelanggan">Master Data Pelanggan</option>
              <option value="Barang">Master Data Barang (Accurate)</option>
              <option value="SIMOTANDI">SIMOTANDI Fase Padi</option>
            </select>
          </div>

          {(statusFilter || typeFilter) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('')
                setTypeFilter('')
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--danger)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <X size={14} strokeWidth={1.75} /> Reset Filter
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Menampilkan <span className="num">{logs.length}</span> dari <span className="num">{totalCount}</span> log
        </div>
      </div>

      {/* Main Table Container (Exact Format as Image) */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-2)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}
              >
                <th style={{ padding: '0.75rem 1.25rem', width: '190px' }}>Waktu (WIB)</th>
                <th style={{ padding: '0.75rem 1rem', width: '260px' }}>Tipe Data</th>
                <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Pemicu</th>
                <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', width: '120px', textAlign: 'center' }}>Data Diproses</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid var(--border)',
                        borderTopColor: 'var(--text-muted)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 0.75rem',
                      }}
                    />
                    Memuat riwayat sinkronisasi...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ClipboardList size={28} strokeWidth={1.5} style={{ marginBottom: '0.5rem', color: 'var(--text-light)' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                      Belum Ada Riwayat Log Sinkronisasi
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Jalankan salah satu sinkronisasi di atas atau tunggu jadwal otomatis (05:00 WIB) untuk mencatat log baru.
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS'
                  const isRunning = log.status === 'RUNNING'
                  const isManual = log.triggerType === 'MANUAL'

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Waktu (WIB) */}
                      <td
                        style={{
                          padding: '0.75rem 1.25rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatWibDate(log.startedAt)}
                      </td>

                      {/* Tipe Data */}
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontWeight: 500,
                          color: 'var(--text-main)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {log.dataType}
                      </td>

                      {/* Pemicu */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: isManual ? 'var(--info-bg)' : 'var(--surface-2)',
                            color: isManual ? 'var(--info)' : 'var(--text-secondary)',
                          }}
                        >
                          {isManual ? 'Manual' : 'Otomatis'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: isSuccess ? 'var(--success-bg)' : isRunning ? 'var(--warning-bg)' : 'var(--danger-bg)',
                            color: isSuccess ? 'var(--success)' : isRunning ? 'var(--warning)' : 'var(--danger)',
                          }}
                        >
                          {isSuccess ? 'Berhasil' : isRunning ? 'Diproses' : 'Gagal'}
                        </span>
                      </td>

                      {/* Data Diproses */}
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: 'var(--text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {log.processedCount.toLocaleString('id-ID')}
                      </td>

                      {/* Keterangan */}
                      <td
                        style={{
                          padding: '0.75rem 1.25rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          lineHeight: 1.4,
                        }}
                      >
                        {log.message || '-'}
                        {log.errorDetail && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                            {log.errorDetail}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Halaman <span className="num">{page}</span> dari <span className="num">{totalPages}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1)
                  setPage(p)
                  fetchLogs(p, statusFilter, typeFilter)
                }}
                disabled={page <= 1}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: page <= 1 ? 'var(--surface-2)' : 'var(--surface)',
                  color: page <= 1 ? 'var(--text-light)' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowLeft size={14} strokeWidth={1.75} className="icon-inline" /> Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1)
                  setPage(p)
                  fetchLogs(p, statusFilter, typeFilter)
                }}
                disabled={page >= totalPages}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: page >= totalPages ? 'var(--surface-2)' : 'var(--surface)',
                  color: page >= totalPages ? 'var(--text-light)' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Selanjutnya <ArrowRight size={14} strokeWidth={1.75} className="icon-inline" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
