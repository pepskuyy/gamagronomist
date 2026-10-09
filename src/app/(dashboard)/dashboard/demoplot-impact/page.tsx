'use client'

import { useEffect, useState, useTransition } from 'react'
import DemoplotImpactMap from '@/components/demoplot-impact/DemoplotImpactMap'
import DemoplotImpactSidebar from '@/components/demoplot-impact/DemoplotImpactSidebar'
import StoreHistoryModal from '@/components/demoplot-impact/StoreHistoryModal'
import TopDemoplotProductsChart from '@/components/demoplot-impact/TopDemoplotProductsChart'
import { MapDemoplotItem } from '@/components/demoplot-impact/DemoplotImpactMapInner'
import { DemoplotImpactDetail, StoreImpactResult } from '@/lib/demoplot-impact'

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

  // 1. Ambil daftar demoplot & produk teratas
  const loadDemoplotList = () => {
    setLoadingList(true)
    fetch('/api/demoplot-impact/list')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data demoplot.')
        return res.json()
      })
      .then((data) => {
        const dps: MapDemoplotItem[] = data.demoplots || []
        setDemoplots(dps)
        setTopProducts(data.topProducts || [])
        setLoadingList(false)

        // Otomatis pilih demoplot pertama jika belum ada yang dipilih dan data tersedia
        if (dps.length > 0 && !selectedDemoplotId) {
          handleSelectDemoplot(dps[0])
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

  // 4. Trigger sinkronisasi data sales manual
  const handleSyncSales = () => {
    if (!confirm('Jalankan sinkronisasi data toko & faktur penjualan dari Sales Dashboard sekarang?')) return

    setSyncMsg(null)
    startSync(async () => {
      try {
        const res = await fetch('/api/cron/sync-sales-dashboard')
        const json = await res.json()
        if (json.success) {
          setSyncMsg(`✅ Sinkronisasi berhasil! ${json.customers?.upserted || 0} toko & ${json.invoices?.total || 0} faktur diperbarui.`)
          loadDemoplotList()
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
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
      <TopDemoplotProductsChart data={topProducts} loading={loadingList} />

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
