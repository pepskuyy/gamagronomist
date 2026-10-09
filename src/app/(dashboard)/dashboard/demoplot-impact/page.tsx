'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import DemoplotImpactMap from '@/components/demoplot-impact/DemoplotImpactMap'
import DemoplotImpactSidebar from '@/components/demoplot-impact/DemoplotImpactSidebar'
import StoreHistoryModal from '@/components/demoplot-impact/StoreHistoryModal'
import TopDemoplotProductsChart from '@/components/demoplot-impact/TopDemoplotProductsChart'
import { MapDemoplotItem } from '@/components/demoplot-impact/DemoplotImpactMapInner'
import { DemoplotImpactDetail, StoreImpactResult } from '@/lib/demoplot-impact'
import { formatDateId } from '@/lib/date-utils'

export default function DemoplotImpactPage() {
  const [demoplots, setDemoplots] = useState<MapDemoplotItem[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [selectedDemoplotId, setSelectedDemoplotId] = useState<string | null>(null)
  const [impactDetail, setImpactDetail] = useState<DemoplotImpactDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedStore, setSelectedStore] = useState<StoreImpactResult | null>(null)
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false)

  const [isSyncing, startSync] = useTransition()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Filter rentang tanggal
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [activePreset, setActivePreset] = useState<string>('all')
  const [topProductType, setTopProductType] = useState<'demoplot' | 'spot-demplot' | 'all'>('demoplot')

  // 1. Ambil daftar demoplot & produk teratas berdasarkan rentang tanggal
  const loadDemoplotList = (from?: string, to?: string, type = topProductType) => {
    setLoadingList(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (type) params.set('type', type)

    fetch(`/api/demoplot-impact/list?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data demoplot.')
        return res.json()
      })
      .then((data) => {
        const dps: MapDemoplotItem[] = data.demoplots || []
        setDemoplots(dps)
        setTopProducts(data.topProducts || [])
        setLoadingList(false)

        // Otomatis pilih demoplot pertama jika belum ada atau yang terpilih tidak ada di list
        if (dps.length > 0) {
          const stillExists = dps.some((d) => d.id === selectedDemoplotId)
          if (!stillExists) {
            handleSelectDemoplot(dps[0])
          }
        } else {
          setSelectedDemoplotId(null)
          setImpactDetail(null)
        }
      })
      .catch((err) => {
        console.error('Error load demoplot list:', err)
        setLoadingList(false)
      })
  }

  useEffect(() => {
    loadDemoplotList()
  }, [])

  // 2. Handler saat titik demoplot dipilih
  const handleSelectDemoplot = (dp: MapDemoplotItem) => {
    setSelectedDemoplotId(dp.id)
    setLoadingDetail(true)
    setDetailError(null)

    fetch(`/api/demoplot-impact?id=${dp.id}&radiusKm=5&windowDays=60`)
      .then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error || 'Gagal memuat analitik dampak demoplot.')
        }
        return res.json()
      })
      .then((detail: DemoplotImpactDetail) => {
        setImpactDetail(detail)
        setLoadingDetail(false)
      })
      .catch((err: any) => {
        setDetailError(err.message || 'Terjadi kesalahan sistem.')
        setLoadingDetail(false)
      })
  }

  // 3. Handler saat toko diklik untuk membuka modal riwayat 12 bulan
  const handleSelectStore = (store: StoreImpactResult) => {
    setSelectedStore(store)
    setIsStoreModalOpen(true)
  }

  const handleTopProductTypeChange = (newType: 'demoplot' | 'spot-demplot' | 'all') => {
    setTopProductType(newType)
    loadDemoplotList(fromDate, toDate, newType)
  }

  // 4. Quick Presets Rentang Tanggal
  const handlePreset = (preset: string) => {
    setActivePreset(preset)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    if (preset === 'all') {
      setFromDate('')
      setToDate('')
      loadDemoplotList('', '')
      return
    }

    if (preset === 'year') {
      const year = now.getFullYear()
      const f = `${year}-01-01`
      const t = today
      setFromDate(f)
      setToDate(t)
      loadDemoplotList(f, t)
      return
    }

    let days = 30
    if (preset === '60d') days = 60
    if (preset === '90d') days = 90

    const f = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    setFromDate(f)
    setToDate(today)
    loadDemoplotList(f, today)
  }

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setActivePreset('custom')
    loadDemoplotList(fromDate, toDate)
  }

  const handleResetFilter = () => {
    setActivePreset('all')
    setFromDate('')
    setToDate('')
    loadDemoplotList('', '')
  }

  const periodLabel = useMemo(() => {
    if (fromDate && toDate) {
      return `${formatDateId(fromDate)} — ${formatDateId(toDate)}`
    }
    if (fromDate) return `Sejak ${formatDateId(fromDate)}`
    if (toDate) return `Hingga ${formatDateId(toDate)}`
    return 'Semua Waktu'
  }, [fromDate, toDate])

  // 5. Trigger sinkronisasi data sales manual
  const handleSyncSales = () => {
    if (!confirm('Jalankan sinkronisasi data toko & faktur penjualan dari Sales Dashboard sekarang?')) return

    setSyncMsg(null)
    startSync(async () => {
      try {
        const res = await fetch('/api/cron/sync-sales-dashboard', { credentials: 'include' })
        const json = await res.json()
        if (json.success) {
          setSyncMsg(`✅ Sinkronisasi berhasil! ${json.customers?.upserted || 0} toko & ${json.invoices?.total || 0} faktur diperbarui.`)
          loadDemoplotList(fromDate, toDate)
          if (selectedDemoplotId) {
            const current = demoplots.find((d) => d.id === selectedDemoplotId)
            if (current) handleSelectDemoplot(current)
          }
        } else {
          setSyncMsg(`❌ Gagal: ${json.error || 'Terjadi kesalahan saat sync.'}`)
        }
      } catch (err: any) {
        setSyncMsg(`❌ Gagal sinkronisasi: ${err.message}`)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            📈 Analitik Dampak Penjualan Demo Plot
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Visualisasi korelasi demoplot dengan perubahan pembelian toko binaan (radius ≤ 5 km, 60 hari sebelum vs sesudah kegiatan)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleSyncSales}
            disabled={isSyncing}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            {isSyncing ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid #ffffff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                Menyinkronkan...
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Sinkronkan Data Sales</span>
              </>
            )}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            background: syncMsg.startsWith('✅') ? '#f0fdf4' : '#fee2e2',
            color: syncMsg.startsWith('✅') ? '#15803d' : '#b91c1c',
            border: `1px solid ${syncMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {syncMsg}
        </div>
      )}

      {/* Date Range Filter Bar */}
      <div className="card" style={{ padding: '1.1rem 1.35rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📅</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Filter Rentang Tanggal Kegiatan Demo Plot
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: '#f1f5f9', color: '#475569' }}>
              {demoplots.length} kegiatan tampil
            </span>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: '30d', label: '30 Hari Terakhir' },
              { id: '60d', label: '60 Hari Terakhir' },
              { id: '90d', label: '90 Hari Terakhir' },
              { id: 'year', label: 'Tahun Ini' },
            ].map((p) => {
              const isActive = activePreset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isActive ? 'var(--primary-light)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    transition: 'var(--transition)',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Inputs Form */}
        <form onSubmit={handleApplyCustomFilter} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Dari:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setActivePreset('custom')
              }}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.65rem',
                fontSize: '0.82rem',
                color: '#374151',
                background: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sampai:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setActivePreset('custom')
              }}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.65rem',
                fontSize: '0.82rem',
                color: '#374151',
                background: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600 }}
          >
            Terapkan
          </button>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="btn btn-outline"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: '#fca5a5' }}
            >
              ✕ Reset
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Periode aktif: <strong>{periodLabel}</strong>
          </div>
        </form>
      </div>

      {/* Main Container: Map (Left) + Detail Sidebar (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 420px',
          gap: '1.25rem',
          alignItems: 'stretch',
        }}
        className="impact-grid"
      >
        {/* Left: Map */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
            height: '800px',
            minHeight: '600px',
          }}
        >
          <DemoplotImpactMap
            demoplots={demoplots}
            selectedDemoplotId={selectedDemoplotId}
            onSelectDemoplot={handleSelectDemoplot}
            storesInRadius={impactDetail?.stores || []}
            onSelectStore={handleSelectStore}
          />
        </div>

        {/* Right: Detail Sidebar */}
        <div style={{ height: '800px' }}>
          <DemoplotImpactSidebar
            data={impactDetail}
            loading={loadingDetail}
            error={detailError}
            onSelectStore={handleSelectStore}
            onClose={() => {
              setSelectedDemoplotId(null)
              setImpactDetail(null)
            }}
          />
        </div>
      </div>

      {/* Bottom Section: Top Products Chart */}
      <TopDemoplotProductsChart
        data={topProducts}
        loading={loadingList}
        periodLabel={periodLabel}
        activeType={topProductType}
        onTypeChange={handleTopProductTypeChange}
      />

      {/* Store 12-Month History Modal */}
      <StoreHistoryModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        store={selectedStore}
      />

      <style jsx>{`
        @media (max-width: 1080px) {
          :global(.impact-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
