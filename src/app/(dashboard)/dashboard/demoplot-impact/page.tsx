'use client'

import { useEffect, useState, useTransition, useMemo, useRef } from 'react'
import { AlertOctagon, BarChart3, Calendar, Check, CheckCircle2, ClipboardList, Compass, Info, Package, RefreshCw, Search, Settings, Star, Target, X, XCircle } from 'lucide-react'
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
      impact_label: '-',
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
      <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <div style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)' }}>
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Analitik & Rekomendasi Demo Plot
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
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
                <RefreshCw size={16} strokeWidth={1.75} />
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
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            background: syncMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: syncMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {syncMsg.startsWith('✅') ? <CheckCircle2 size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} /> : <XCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />}
          <span>{syncMsg.replace(/^(✅|❌)\s*/, '')}</span>
        </div>
      )}

      {/* TAB NAVIGATION SWITCHER */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('impact')}
          style={{
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'impact' ? 'var(--text-main)' : 'var(--text-muted)',
            borderBottom: activeTab === 'impact' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'var(--transition)',
          }}
        >
          <BarChart3 size={16} strokeWidth={1.75} />
          <span>Evaluasi Dampak Penjualan</span>
          <span
            className="num"
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.375rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {demoplots.length} kegiatan
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('opportunity')}
          style={{
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'opportunity' ? 'var(--text-main)' : 'var(--text-muted)',
            borderBottom: activeTab === 'opportunity' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'var(--transition)',
          }}
        >
          <Target size={16} strokeWidth={1.75} />
          <span>Opportunity Finder (Rekomendasi Lokasi)</span>
          <span
            className="num"
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.375rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--warning-bg)',
              color: 'var(--warning)',
              fontWeight: 500,
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
          <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Calendar size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Filter Rentang Tanggal Kegiatan Demo Plot
                </span>
                <span className="num" style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {demoplots.length} kegiatan tampil
                </span>
              </div>

              {/* Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
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
                        padding: '0.25rem 0.625rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
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
            <form onSubmit={handleApplyCustomFilter} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    background: 'var(--surface)',
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
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    background: 'var(--surface)',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.375rem 1rem', fontSize: '0.8rem', fontWeight: 500 }}
              >
                Terapkan
              </button>

              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="btn btn-outline"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 500 }}
                >
                  <X size={14} strokeWidth={1.75} /> Reset
                </button>
              )}

              <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Periode aktif: <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{periodLabel}</strong>
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
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <AlertOctagon size={14} strokeWidth={1.75} style={{ color: 'var(--danger)' }} /> Zona Kawal Sell-Out (Mendesak)
              </div>
              <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--danger)', marginTop: '0.25rem' }}>
                {oppResult?.summary.urgent_sellout_zones_count || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                  zona prioritas
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Toko sudah ada stok, belum ada demplot
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Star size={14} strokeWidth={1.75} style={{ color: 'var(--warning)' }} /> Kios Memasok Produk Fokus
              </div>
              <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {oppResult?.summary.total_stocked_stores || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                  kios binaan
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Sudah kulakan produk dari tim Sales
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Package size={14} strokeWidth={1.75} /> Nilai Stok Produk Sales di Kios
              </div>
              <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {formatRp(oppResult?.summary.total_dev_stock_omset || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Perlu edukasi lapangan agar segera terserap
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Target size={14} strokeWidth={1.75} /> Total Zona Peluang Terdeteksi
              </div>
              <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {oppResult?.summary.total_zones_found || 0}
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                  klaster 5 km
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Berdasarkan 2.980 toko berkoordinat
              </div>
            </div>
          </div>

          {/* Opportunity Control & Filter Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Filter Parameter Analisis Peluang Lapangan
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsScoringModalOpen(true)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <Info size={16} strokeWidth={1.75} />
                  <span>Mekanisme Skoring</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDevModalOpen(true)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <Settings size={16} strokeWidth={1.75} />
                  <span>Kelola Produk Fokus ({oppResult?.summary.active_dev_products_count || 0})</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Filter Region */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Wilayah:</span>
                <select
                  value={oppRegion}
                  onChange={(e) => {
                    const r = e.target.value
                    setOppRegion(r)
                    loadOpportunities(r, oppSalesman, oppProduct)
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    background: 'var(--surface)',
                  }}
                >
                  <option value="">Semua Wilayah</option>
                  <option value="Jawa Timur">Jawa Timur</option>
                  <option value="Jawa Tengah">Jawa Tengah</option>
                  <option value="NTB">NTB</option>
                </select>
              </div>

              {/* Filter Produk Pengembangan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Produk Fokus:</span>
                <select
                  value={oppProduct}
                  onChange={(e) => {
                    const p = e.target.value
                    setOppProduct(p)
                    loadOpportunities(oppRegion, oppSalesman, p)
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    background: 'var(--surface)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
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
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    background: 'var(--surface)',
                    width: '160px',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => loadOpportunities(oppRegion, oppSalesman, oppProduct)}
                className="btn btn-primary"
                style={{ padding: '0.375rem 1rem', fontSize: '0.8rem', fontWeight: 500 }}
              >
                <Search size={14} strokeWidth={1.75} /> Terapkan Filter
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
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 500 }}
                >
                  <X size={14} strokeWidth={1.75} /> Reset
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
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Target size={32} strokeWidth={1.5} style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Belum Ada Produk Fokus yang Diaktifkan
              </h3>
              <p
                style={{
                  margin: '0.5rem auto 1.5rem',
                  maxWidth: '540px',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
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
                  padding: '0.625rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Settings size={16} strokeWidth={1.75} />
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Tabel Prioritas Rekomendasi Lokasi Demoplot
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Urutan zona di bawah telah dibobotkan berdasarkan urgensi sell-out, ketiadaan demplot, dan densitas kios
                </p>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Menampilkan <strong className="num" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{oppResult?.zones.length || 0}</strong> zona prioritas
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
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface-2)', fontSize: '0.8rem' }}>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Rank</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Nama Zona & Wilayah</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Skor Peluang</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Status Urgensi</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Kios Berstok</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Nilai Stok Fokus</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Demplot Terakhir</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>Sales Terkait</th>
                      <th style={{ padding: '0.625rem 0.75rem', fontWeight: 500, textAlign: 'center' }}>Aksi</th>
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
                            borderBottom: '1px solid var(--border-light)',
                            background: isSelected ? 'var(--primary-light)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                          }}
                        >
                          <td className="num" style={{ padding: '0.625rem 0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                            #{z.rank}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{z.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {z.city || '-'} ({z.region || '-'})
                            </div>
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            <span
                              className="num"
                              style={{
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: z.score >= 80 ? 'var(--danger)' : z.score >= 60 ? 'var(--warning)' : 'var(--success)',
                              }}
                            >
                              {z.score} / 100
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.125rem 0.5rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background:
                                  z.urgency_badge_color === 'red'
                                    ? 'var(--danger-bg)'
                                    : z.urgency_badge_color === 'amber'
                                    ? 'var(--warning-bg)'
                                    : z.urgency_badge_color === 'emerald'
                                    ? 'var(--success-bg)'
                                    : 'var(--info-bg)',
                                color:
                                  z.urgency_badge_color === 'red'
                                    ? 'var(--danger)'
                                    : z.urgency_badge_color === 'amber'
                                    ? 'var(--warning)'
                                    : z.urgency_badge_color === 'emerald'
                                    ? 'var(--success)'
                                    : 'var(--info)',
                              }}
                            >
                              {z.urgency_label}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            <span className="num" style={{ fontWeight: 500, color: 'var(--text-main)' }}>{z.stocked_stores_count}</span>
                            <span className="num" style={{ color: 'var(--text-muted)' }}> / {z.total_stores_in_radius}<span className="unit">kios</span></span>
                          </td>
                          <td className="num" style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>
                            {formatRp(z.total_dev_stock_omset)}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            {z.last_demoplot_days_ago !== null ? (
                              <span className="num" style={{ color: z.last_demoplot_days_ago > 90 ? 'var(--danger)' : 'var(--success)' }}>
                                {z.last_demoplot_days_ago} hari lalu
                              </span>
                            ) : (
                              <span style={{ color: 'var(--danger)', fontWeight: 500 }}>Nihil</span>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {z.salesmen_involved.join(', ') || '-'}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedZoneId(z.id)
                              }}
                              style={{
                                padding: '0.25rem 0.625rem',
                                borderRadius: 'var(--radius-xs)',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--primary)' : 'var(--surface)',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isSelected && <Check size={14} strokeWidth={1.75} />}
                              {isSelected ? 'Terpilih' : 'Lihat di Peta'}
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
