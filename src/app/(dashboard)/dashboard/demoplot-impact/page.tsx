'use client'

import { useEffect, useState, useTransition, useMemo, useRef } from 'react'
import DemoplotImpactMap from '@/components/demoplot-impact/DemoplotImpactMap'
import DemoplotImpactSidebar from '@/components/demoplot-impact/DemoplotImpactSidebar'
import dynamic from 'next/dynamic'
import TopDemoplotProductsChart from '@/components/demoplot-impact/TopDemoplotProductsChart'
import OpportunityMap from '@/components/demoplot-impact/OpportunityMap'
import OpportunitySidebar from '@/components/demoplot-impact/OpportunitySidebar'
import type { MapDemoplotItem } from '@/components/demoplot-impact/DemoplotImpactMapInner'
import RadiusCoverageBar from '@/components/demoplot-impact/RadiusCoverageBar'
import DemoplotImpactTable from '@/components/demoplot-impact/DemoplotImpactTable'
import type { RadiusSettingsData } from '@/components/demoplot-impact/RadiusSettingsModal'

// Modal di-load lazy: chunk (termasuk xlsx di DevelopmentProductsModal) baru
// diunduh saat modal pertama kali dibuka. Setelah itu tetap ter-mount agar
// perilaku (state internal modal) sama seperti sebelumnya.
const StoreHistoryModal = dynamic(() => import('@/components/demoplot-impact/StoreHistoryModal'), { ssr: false })
const DevelopmentProductsModal = dynamic(() => import('@/components/demoplot-impact/DevelopmentProductsModal'), { ssr: false })
const OpportunityScoringModal = dynamic(() => import('@/components/demoplot-impact/OpportunityScoringModal'), { ssr: false })
const RadiusSettingsModal = dynamic(() => import('@/components/demoplot-impact/RadiusSettingsModal'), { ssr: false })
import { DemoplotImpactDetail, StoreImpactResult } from '@/lib/demoplot-impact'
import { OpportunityZone, OpportunityFinderResult, ZoneStoreItem } from '@/lib/demoplot-opportunity'
import { formatDateId } from '@/lib/date-utils'

export default function DemoplotImpactPage() {
  const [mounted, setMounted] = useState(false)

  // Tab aktif: 'impact' (Evaluasi Dampak) atau 'opportunity' (Opportunity Finder)
  const [activeTab, setActiveTab] = useState<'impact' | 'opportunity'>('impact')

  // Modal states
  const [isDevModalOpen, setIsDevModalOpen] = useState(false)
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false)
  const [selectedStore, setSelectedStore] = useState<StoreImpactResult | null>(null)
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false)

  // Lazy-mount: modal baru di-mount (dan chunk-nya diunduh) setelah pertama kali dibuka
  const [devModalUsed, setDevModalUsed] = useState(false)
  const [scoringModalUsed, setScoringModalUsed] = useState(false)
  const [storeModalUsed, setStoreModalUsed] = useState(false)
  useEffect(() => { if (isDevModalOpen) setDevModalUsed(true) }, [isDevModalOpen])
  useEffect(() => { if (isScoringModalOpen) setScoringModalUsed(true) }, [isScoringModalOpen])
  useEffect(() => { if (isStoreModalOpen) setStoreModalUsed(true) }, [isStoreModalOpen])

  // Sync state
  const [isSyncing, startSync] = useTransition()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // =========================================================================
  // TAB 1: EVALUASI DAMPAK STATE
  // =========================================================================
  const [demoplots, setDemoplots] = useState<MapDemoplotItem[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [selectedDemoplotId, setSelectedDemoplotId] = useState<string | null>(null)
  const selectedDemoplotIdRef = useRef<string | null>(null)
  const [impactDetail, setImpactDetail] = useState<DemoplotImpactDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Filter rentang tanggal
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [activePreset, setActivePreset] = useState<string>('all')
  const [topProductType, setTopProductType] = useState<'demoplot' | 'spot-demplot' | 'all'>('demoplot')

  // Radius coverage: default dari server, override hanya di halaman ini (tidak disimpan)
  const [radiusSettings, setRadiusSettings] = useState<RadiusSettingsData | null>(null)
  const [radiusOverride, setRadiusOverride] = useState<number | null>(null)
  const radiusOverrideRef = useRef<number | null>(null)
  const [isRadiusModalOpen, setIsRadiusModalOpen] = useState(false)
  const listReqRef = useRef(0)
  const detailReqRef = useRef(0)
  const defaultRadius = radiusSettings?.radius_km ?? 2.5
  const activeRadius = radiusOverride ?? defaultRadius

  const loadDemoplotList = (from?: string, to?: string, type = topProductType, radius = radiusOverrideRef.current) => {
    setLoadingList(true)
    const reqId = ++listReqRef.current
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (type) params.set('type', type)
    if (radius !== null) params.set('radiusKm', String(radius))

    fetch(`/api/demoplot-impact/list?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data demoplot.')
        return res.json()
      })
      .then((data) => {
        if (reqId !== listReqRef.current) return // respons usang (radius/filter sudah berganti)
        const dps: MapDemoplotItem[] = data.demoplots || []
        setDemoplots(dps)
        setTopProducts(data.topProducts || [])
        setLoadingList(false)

        if (dps.length > 0) {
          const stillExists = dps.some((d) => d.id === selectedDemoplotIdRef.current)
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
        if (reqId === listReqRef.current) setLoadingList(false)
      })
  }

  const handleSelectDemoplot = (dp: Pick<MapDemoplotItem, 'id'>, radius = radiusOverrideRef.current) => {
    setSelectedDemoplotId(dp.id)
    selectedDemoplotIdRef.current = dp.id
    setLoadingDetail(true)
    setDetailError(null)
    const reqId = ++detailReqRef.current
    const radiusParam = radius !== null ? `&radiusKm=${radius}` : ''

    fetch(`/api/demoplot-impact?id=${dp.id}${radiusParam}`)
      .then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error || 'Gagal memuat analitik dampak demoplot.')
        }
        return res.json()
      })
      .then((detail: DemoplotImpactDetail) => {
        if (reqId !== detailReqRef.current) return
        setImpactDetail(detail)
        setLoadingDetail(false)
      })
      .catch((err: any) => {
        if (reqId !== detailReqRef.current) return
        setDetailError(err.message || 'Terjadi kesalahan sistem.')
        setLoadingDetail(false)
      })
  }

  /** Ganti radius tampilan (null = kembali ke default); hitung ulang ringkasan & detail terpilih. */
  const handleRadiusChange = (radius: number | null) => {
    radiusOverrideRef.current = radius
    setRadiusOverride(radius)
    loadDemoplotList(fromDate, toDate, topProductType, radius)
    if (selectedDemoplotIdRef.current) handleSelectDemoplot({ id: selectedDemoplotIdRef.current }, radius)
  }

  const handleRadiusSaved = (next: RadiusSettingsData) => {
    setRadiusSettings(next)
    setIsRadiusModalOpen(false)
    // Default berubah: muat ulang bila user sedang memakai default
    if (radiusOverrideRef.current === null || radiusOverrideRef.current === next.radius_km) {
      handleRadiusChange(null)
    }
  }

  const handleTopProductTypeChange = (newType: 'demoplot' | 'spot-demplot' | 'all') => {
    setTopProductType(newType)
    loadDemoplotList(fromDate, toDate, newType)
  }

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

  // =========================================================================
  // TAB 2: OPPORTUNITY FINDER STATE
  // =========================================================================
  const [oppResult, setOppResult] = useState<OpportunityFinderResult | null>(null)
  const [loadingOpp, setLoadingOpp] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  // Filter Opportunity Finder
  const [oppRegion, setOppRegion] = useState('')
  const [oppSalesman, setOppSalesman] = useState('')
  const [oppProduct, setOppProduct] = useState('')

  const loadOpportunities = (region = oppRegion, salesman = oppSalesman, product = oppProduct) => {
    setLoadingOpp(true)
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (salesman) params.set('salesman', salesman)
    if (product) params.set('product', product)

    fetch(`/api/demoplot-impact/opportunities?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat rekomendasi peluang demoplot.')
        return res.json()
      })
      .then((data: OpportunityFinderResult) => {
        setOppResult(data)
        setLoadingOpp(false)
        if (data.zones && data.zones.length > 0) {
          const still = data.zones.find((z) => z.id === selectedZoneId)
          if (!still) {
            setSelectedZoneId(data.zones[0].id)
          }
        } else {
          setSelectedZoneId(null)
        }
      })
      .catch((err) => {
        console.error('Error load opportunities:', err)
        setLoadingOpp(false)
      })
  }

  // Load initial data
  useEffect(() => {
    setMounted(true)
    loadDemoplotList()
    fetch('/api/demoplot-impact/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RadiusSettingsData | null) => {
        if (data) setRadiusSettings(data)
      })
      .catch(() => {})
  }, [])

  // Lazy load opportunity finder data only when Tab 2 is clicked
  useEffect(() => {
    if (activeTab === 'opportunity' && !oppResult && !loadingOpp) {
      loadOpportunities()
    }
  }, [activeTab])

  const selectedZone = useMemo(() => {
    if (!oppResult?.zones) return null
    return oppResult.zones.find((z) => z.id === selectedZoneId) || null
  }, [oppResult, selectedZoneId])

  // Modal Toko: Membuka riwayat 12 bulan toko
  const handleOpenStoreModal = (store: any) => {
    setSelectedStore({
      customer_id: store.customer_id || store.id,
      customer_no: store.customer_no,
      name: store.name,
      city: store.city,
      region: store.region,
      default_salesman: store.default_salesman,
      latitude: store.latitude || 0,
      longitude: store.longitude || 0,
      distance_km: store.distance_km || 0,
      has_impact: true,
      impact_total_qty: 0,
      impact_total_omset: 0,
      impact_products: [],
      before_total_omset: 0,
      after_total_omset: 0,
    })
    setIsStoreModalOpen(true)
  }

  // Trigger sinkronisasi data sales manual
  const handleSyncSales = () => {
    if (!confirm('Jalankan sinkronisasi data toko & faktur penjualan dari Sales Dashboard sekarang?')) return

    setSyncMsg(null)
    startSync(async () => {
      try {
        const res = await fetch('/api/cron/sync-sales-dashboard', { credentials: 'include' })
        const json = await res.json()
        if (json.success) {
          setSyncMsg(
            `✅ Sinkronisasi berhasil! ${json.customers?.upserted || 0} toko & ${json.invoices?.total || 0} faktur diperbarui.`
          )
          loadDemoplotList(fromDate, toDate)
          loadOpportunities(oppRegion, oppSalesman, oppProduct)
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

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  if (!mounted) {
    return (
      <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid #cbd5e1',
            borderTopColor: '#0284c7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
          Memuat Analitik & Rekomendasi Demplot...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
            📈 Analitik & Rekomendasi Demo Plot
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Analisis dampak penjualan kegiatan di lapangan & rekomendasi titik demplot baru berbasis serapan produk fokus (Follow-The-Sales)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Tombol Sinkronisasi Data Sales */}
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

      {/* Sync Message Alert */}
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

      {/* TAB NAVIGATION SWITCHER */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border, #e2e8f0)',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('impact')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem 0.5rem 0 0',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'impact' ? 'var(--surface, #ffffff)' : 'transparent',
            color: activeTab === 'impact' ? 'var(--primary, #0284c7)' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'impact' ? '3px solid var(--primary, #0284c7)' : '3px solid transparent',
            marginBottom: '-4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
          }}
        >
          <span>📊</span>
          <span>Evaluasi Dampak Penjualan</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              background: activeTab === 'impact' ? '#e0f2fe' : '#f1f5f9',
              color: activeTab === 'impact' ? '#0369a1' : '#64748b',
              fontWeight: 700,
            }}
          >
            {demoplots.length} kegiatan
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('opportunity')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem 0.5rem 0 0',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'opportunity' ? 'var(--surface, #ffffff)' : 'transparent',
            color: activeTab === 'opportunity' ? '#b45309' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'opportunity' ? '3px solid #d97706' : '3px solid transparent',
            marginBottom: '-4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
          }}
        >
          <span>🎯</span>
          <span>Opportunity Finder (Rekomendasi Lokasi)</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              background: '#fef3c7',
              color: '#92400e',
              fontWeight: 700,
            }}
          >
            {oppResult?.summary.urgent_sellout_zones_count || 0} Mendesak
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 CONTENT: EVALUASI DAMPAK DEMPLOT                                    */}
      {/* ========================================================================= */}
      {activeTab === 'impact' && (
        <>
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

          {/* Radius coverage (di atas peta) */}
          <RadiusCoverageBar
            defaultRadius={defaultRadius}
            activeRadius={activeRadius}
            isOverride={radiusOverride !== null}
            canEdit={!!radiusSettings?.can_edit}
            onChange={handleRadiusChange}
            onOpenSettings={() => setIsRadiusModalOpen(true)}
          />

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
                onSelectStore={handleOpenStoreModal}
                radiusKm={activeRadius}
              />
            </div>

            {/* Right: Detail Sidebar */}
            <div style={{ height: '800px' }}>
              <DemoplotImpactSidebar
                data={impactDetail}
                loading={loadingDetail}
                error={detailError}
                onSelectStore={handleOpenStoreModal}
                onClose={() => {
                  setSelectedDemoplotId(null)
                  selectedDemoplotIdRef.current = null
                  setImpactDetail(null)
                }}
                radiusKm={activeRadius}
                impact={demoplots.find((d) => d.id === selectedDemoplotId)?.impact ?? null}
                impactLoading={loadingList}
              />
            </div>
          </div>

          {/* Daftar demplot + % terdampak */}
          <DemoplotImpactTable
            demoplots={demoplots}
            loading={loadingList}
            radiusKm={activeRadius}
            selectedDemoplotId={selectedDemoplotId}
            onSelect={(dp) => handleSelectDemoplot(dp)}
            periodLabel={periodLabel}
          />

          {/* Bottom Section: Top Products Chart */}
          <TopDemoplotProductsChart
            data={topProducts}
            loading={loadingList}
            periodLabel={periodLabel}
            activeType={topProductType}
            onTypeChange={handleTopProductTypeChange}
          />
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 CONTENT: OPPORTUNITY FINDER (REKOMENDASI LOKASI DEMOPLOT BARU)       */}
      {/* ========================================================================= */}
      {activeTab === 'opportunity' && (
        <>
          {/* Summary Metric Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                🚨 Zona Kawal Sell-Out (Mendesak)
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                {oppResult?.summary.urgent_sellout_zones_count || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                  zona prioritas
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Toko sudah ada stok, belum ada demplot
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                ⭐ Kios Memasok Produk Fokus
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                {oppResult?.summary.total_stocked_stores || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                  kios binaan
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Sudah kulakan produk dari tim Sales
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                📦 Nilai Stok Produk Sales di Kios
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0369a1', marginTop: '0.25rem' }}>
                {formatRp(oppResult?.summary.total_dev_stock_omset || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Perlu edukasi lapangan agar segera terserap
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                🎯 Total Zona Peluang Terdeteksi
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>
                {oppResult?.summary.total_zones_found || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                  klaster 5 km
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Berdasarkan 2.980 toko berkoordinat
              </div>
            </div>
          </div>

          {/* Opportunity Control & Filter Bar */}
          <div className="card" style={{ padding: '1.1rem 1.35rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🧭</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Filter Parameter Analisis Peluang Lapangan
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsScoringModalOpen(true)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: '#f0f9ff',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>💡</span>
                  <span>Mekanisme Skoring</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDevModalOpen(true)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: '#fff7ed',
                    color: '#c2410c',
                    border: '1px solid #ffedd5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>⚙️</span>
                  <span>Kelola Produk Fokus ({oppResult?.summary.active_dev_products_count || 0})</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              {/* Filter Region */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Wilayah:</span>
                <select
                  value={oppRegion}
                  onChange={(e) => {
                    const r = e.target.value
                    setOppRegion(r)
                    loadOpportunities(r, oppSalesman, oppProduct)
                  }}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.82rem',
                    color: '#374151',
                    background: '#fff',
                  }}
                >
                  <option value="">Semua Wilayah</option>
                  <option value="Jawa Timur">Jawa Timur</option>
                  <option value="Jawa Tengah">Jawa Tengah</option>
                  <option value="NTB">NTB</option>
                </select>
              </div>

              {/* Filter Produk Pengembangan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Produk Fokus:</span>
                <select
                  value={oppProduct}
                  onChange={(e) => {
                    const p = e.target.value
                    setOppProduct(p)
                    loadOpportunities(oppRegion, oppSalesman, p)
                  }}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.82rem',
                    color: '#374151',
                    background: '#fff',
                    maxWidth: '220px',
                  }}
                >
                  <option value="">Semua Produk Fokus Aktif</option>
                  {oppResult?.summary.active_dev_products?.map((dp) => (
                    <option key={dp.id} value={dp.name}>
                      {dp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Salesman */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Salesman:</span>
                <input
                  type="text"
                  placeholder="Cari nama sales..."
                  value={oppSalesman}
                  onChange={(e) => setOppSalesman(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadOpportunities(oppRegion, oppSalesman, oppProduct)
                    }
                  }}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.82rem',
                    color: '#374151',
                    background: '#fff',
                    width: '160px',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => loadOpportunities(oppRegion, oppSalesman, oppProduct)}
                className="btn btn-primary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600 }}
              >
                🔍 Terapkan Filter
              </button>

              {(oppRegion || oppSalesman || oppProduct) && (
                <button
                  type="button"
                  onClick={() => {
                    setOppRegion('')
                    setOppSalesman('')
                    setOppProduct('')
                    loadOpportunities('', '', '')
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: '#fca5a5' }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          {/* Banner jika belum ada produk fokus yang diaktifkan */}
          {!loadingOpp && (!oppResult || oppResult.summary.active_dev_products_count === 0) && (
            <div
              className="card"
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                background: '#ffffff',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '1rem',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Belum Ada Produk Fokus yang Diaktifkan
              </h3>
              <p
                style={{
                  margin: '0.5rem auto 1.5rem',
                  maxWidth: '540px',
                  color: '#64748b',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                }}
              >
                Mesin <strong>Opportunity Finder</strong> mendeteksi titik rekomendasi demplot berdasarkan data penjualan produk fokus di toko binaan (strategi <em>Follow-The-Sales</em>). Silakan pilih minimal 1 produk fokus terlebih dahulu agar sistem dapat menganalisis area prioritas.
              </p>
              <button
                type="button"
                onClick={() => setIsDevModalOpen(true)}
                className="btn btn-primary"
                style={{
                  padding: '0.65rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>⚙️</span>
                <span>Pilih & Aktifkan Produk Fokus Sekarang</span>
              </button>
            </div>
          )}

          {/* Main Opportunity Container: Map (Left) + Detail Sidebar (Right) */}
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
              <OpportunityMap
                zones={oppResult?.zones || []}
                selectedZoneId={selectedZoneId}
                onSelectZone={(zone) => setSelectedZoneId(zone.id)}
                onSelectStore={handleOpenStoreModal}
              />
            </div>

            {/* Right: Detail Sidebar */}
            <div style={{ height: '800px' }}>
              <OpportunitySidebar
                zone={selectedZone}
                loading={loadingOpp}
                onSelectStore={handleOpenStoreModal}
                onClose={() => setSelectedZoneId(null)}
              />
            </div>
          </div>

          {/* Bottom Table: Daftar Peringkat Zona Rekomendasi */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  📋 Tabel Prioritas Rekomendasi Lokasi Demoplot
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Urutan zona di bawah telah dibobotkan berdasarkan urgensi sell-out, ketiadaan demplot, dan densitas kios
                </p>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Menampilkan <strong>{oppResult?.zones.length || 0}</strong> zona prioritas
              </div>
            </div>

            {loadingOpp ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Menghitung peringkat zona...
              </div>
            ) : !oppResult?.zones || oppResult.zones.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Tidak ada zona rekomendasi yang cocok dengan kriteria filter saat ini.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Rank</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Nama Zona & Wilayah</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Skor Peluang</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Status Urgensi</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Kios Berstok</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Nilai Stok Fokus</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Demplot Terakhir</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Sales Terkait</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oppResult.zones.map((z) => {
                      const isSelected = z.id === selectedZoneId
                      return (
                        <tr
                          key={z.id}
                          onClick={() => setSelectedZoneId(z.id)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#f0f9ff' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>
                            #{z.rank}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{z.title}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {z.city || '-'} ({z.region || '-'})
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                color: z.score >= 80 ? '#dc2626' : z.score >= 60 ? '#d97706' : '#16a34a',
                              }}
                            >
                              {z.score} / 100
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background:
                                  z.urgency_badge_color === 'red'
                                    ? '#fee2e2'
                                    : z.urgency_badge_color === 'amber'
                                    ? '#fef3c7'
                                    : z.urgency_badge_color === 'emerald'
                                    ? '#dcfce7'
                                    : '#e0f2fe',
                                color:
                                  z.urgency_badge_color === 'red'
                                    ? '#991b1b'
                                    : z.urgency_badge_color === 'amber'
                                    ? '#92400e'
                                    : z.urgency_badge_color === 'emerald'
                                    ? '#166534'
                                    : '#0369a1',
                              }}
                            >
                              {z.urgency_label}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#ea580c' }}>{z.stocked_stores_count}</span>
                            <span style={{ color: '#64748b' }}> / {z.total_stores_in_radius} kios</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                            {formatRp(z.total_dev_stock_omset)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            {z.last_demoplot_days_ago !== null ? (
                              <span style={{ color: z.last_demoplot_days_ago > 90 ? '#ef4444' : '#10b981' }}>
                                {z.last_demoplot_days_ago} hari lalu
                              </span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 700 }}>Nihil</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {z.salesmen_involved.join(', ') || '-'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedZoneId(z.id)
                              }}
                              style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.25rem',
                                border: '1px solid #cbd5e1',
                                background: isSelected ? '#0f172a' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#334155',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {isSelected ? '✓ Terpilih' : 'Lihat di Peta'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Radius Coverage Default */}
      {isRadiusModalOpen && radiusSettings && (
        <RadiusSettingsModal
          settings={radiusSettings}
          onClose={() => setIsRadiusModalOpen(false)}
          onSaved={handleRadiusSaved}
        />
      )}

      {/* Modal Kelola Produk Pengembangan */}
      {(devModalUsed || isDevModalOpen) && (
        <DevelopmentProductsModal
          isOpen={isDevModalOpen}
          onClose={() => setIsDevModalOpen(false)}
          onSaved={() => {
            loadOpportunities(oppRegion, oppSalesman, oppProduct)
          }}
        />
      )}

      {/* Modal Penjelasan Mekanisme Skoring */}
      {(scoringModalUsed || isScoringModalOpen) && (
        <OpportunityScoringModal
          isOpen={isScoringModalOpen}
          onClose={() => setIsScoringModalOpen(false)}
        />
      )}

      {/* Modal Riwayat 12 Bulan Transaksi Toko */}
      {(storeModalUsed || isStoreModalOpen) && (
        <StoreHistoryModal
          isOpen={isStoreModalOpen}
          onClose={() => setIsStoreModalOpen(false)}
          store={selectedStore}
        />
      )}

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
