'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'

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
          text: `✅ Sinkronisasi "${label}" selesai diproses!`,
        })
        fetchLogs(1, statusFilter, typeFilter)
      } catch (err: any) {
        setTriggerMsg({
          type: 'error',
          text: `❌ Gagal memicu sinkronisasi: ${err.message}`,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🔄</span>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
              Monitoring Sinkronisasi Data
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '9999px',
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
              }}
            >
              Khusus Admin
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem', color: 'var(--text-muted, #64748b)' }}>
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
              padding: '0.5rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🔄</span>
            <span>Sync Sales Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSync('accurate', 'Accurate Barang & Stok')}
            disabled={isTriggering}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <span>📦</span>
            <span>Sync Accurate</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSync('simotandi', 'SIMOTANDI Fase Padi')}
            disabled={isTriggering}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <span>🌾</span>
            <span>Sync SIMOTANDI</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(page, statusFilter, typeFilter)}
            title="Muat Ulang Log"
            style={{
              padding: '0.5rem 0.65rem',
              fontSize: '0.85rem',
              borderRadius: '0.375rem',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Trigger Feedback Alert */}
      {triggerMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            background: triggerMsg.type === 'success' ? '#f0fdf4' : '#fee2e2',
            color: triggerMsg.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${triggerMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {triggerMsg.text}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        <div className="card" style={{ padding: '0.9rem 1.15rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Sinkronisasi Tercatat</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {summary?.totalRuns || totalCount}
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.3rem' }}>
              eksekusi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Berhasil</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
            {summary?.successCount || 0}
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.3rem' }}>
              sesi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Gagal / Kendala</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', marginTop: '0.2rem' }}>
            {summary?.failedCount || 0}
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.3rem' }}>
              sesi
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Terakhir Dijalankan</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginTop: '0.45rem' }}>
            {summary?.lastRun ? formatWibDate(summary.lastRun) : '-'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Filter Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                background: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="">Semua Status</option>
              <option value="SUCCESS">Berhasil</option>
              <option value="FAILED">Gagal</option>
              <option value="RUNNING">Sedang Berjalan</option>
            </select>
          </div>

          {/* Filter Tipe Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Tipe Data:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                background: '#ffffff',
                color: '#334155',
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
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Menampilkan {logs.length} dari {totalCount} log
        </div>
      </div>

      {/* Main Table Container (Exact Format as Image) */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  background: '#f8fafc',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <th style={{ padding: '0.85rem 1.25rem', width: '190px' }}>Waktu (WIB)</th>
                <th style={{ padding: '0.85rem 1rem', width: '260px' }}>Tipe Data</th>
                <th style={{ padding: '0.85rem 1rem', width: '110px' }}>Pemicu</th>
                <th style={{ padding: '0.85rem 1rem', width: '110px' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', width: '120px', textAlign: 'center' }}>Data Diproses</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid #cbd5e1',
                        borderTopColor: '#0284c7',
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
                  <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
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
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
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
                          padding: '0.85rem 1.25rem',
                          color: '#334155',
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
                          padding: '0.85rem 1rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          fontSize: '0.84rem',
                        }}
                      >
                        {log.dataType}
                      </td>

                      {/* Pemicu */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: isManual ? '#e0f2fe' : '#f1f5f9',
                            color: isManual ? '#0284c7' : '#475569',
                          }}
                        >
                          {isManual ? 'Manual' : 'Otomatis'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: isSuccess ? '#dcfce7' : isRunning ? '#fef3c7' : '#fee2e2',
                            color: isSuccess ? '#16a34a' : isRunning ? '#d97706' : '#dc2626',
                          }}
                        >
                          {isSuccess ? 'Berhasil' : isRunning ? 'Diproses' : 'Gagal'}
                        </span>
                      </td>

                      {/* Data Diproses */}
                      <td
                        style={{
                          padding: '0.85rem 1rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          color: '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {log.processedCount.toLocaleString('id-ID')}
                      </td>

                      {/* Keterangan */}
                      <td
                        style={{
                          padding: '0.85rem 1.25rem',
                          color: '#475569',
                          fontSize: '0.82rem',
                          lineHeight: 1.4,
                        }}
                      >
                        {log.message || '-'}
                        {log.errorDetail && (
                          <div style={{ color: '#dc2626', fontSize: '0.72rem', marginTop: '0.15rem' }}>
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
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Halaman {page} dari {totalPages}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1)
                  setPage(p)
                  fetchLogs(p, statusFilter, typeFilter)
                }}
                disabled={page <= 1}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  background: page <= 1 ? '#f1f5f9' : '#ffffff',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Sebelumnya
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
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Selanjutnya →
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
