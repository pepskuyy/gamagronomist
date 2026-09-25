'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { filterPointsInGeometry } from '@/hooks/useRegionFilter'
import { sumRows, FaseKey, SimotandiWilayahRow } from '@/lib/simotandi-fase'
import SimotandiPeriodSelect, { PeriodeOption } from '@/components/map/SimotandiPeriodSelect'
import SimotandiSummaryCards from '@/components/map/SimotandiSummaryCards'
import SimotandiLegend from '@/components/map/SimotandiLegend'
import RegionDetailPanel from '@/components/map/RegionDetailPanel'

type DemoPlotPoint = {
  id: string
  lat: number
  lng: number
  farmerName: string
  area: string
  commodity: string
  foName: string
  date: string
  productCount: number
  products: string[]
  type: 'spot' | 'mini' | 'full'
}

type StorePoint = {
  id: string
  lat: number
  lng: number
  name: string
  code: string | null
  address: string | null
  phone: string | null
}

const TYPE_CONFIG = {
  spot: {
    label: 'Spot Demo Plot',
    desc: 'Kegiatan terpisah',
    color: '#f59e0b',
    emoji: '⭐',
    bg: '#fffbeb',
    border: '#fcd34d',
    textColor: '#92400e',
  },
  mini: {
    label: 'Mini Demo Plot',
    desc: '1–3 produk',
    color: '#3b82f6',
    emoji: '🔵',
    bg: '#eff6ff',
    border: '#93c5fd',
    textColor: '#1e40af',
  },
  full: {
    label: 'Full Demo Plot',
    desc: '≥4 produk',
    color: '#16a34a',
    emoji: '🟢',
    bg: '#f0fdf4',
    border: '#86efac',
    textColor: '#166534',
  },
}

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b', borderRadius: 'var(--radius-md)' }}>
      🗺️ Memuat peta...
    </div>
  ),
})

export default function DemoPlotMap({ filterQuery = '' }: { filterQuery?: string }) {
  const [points, setPoints]         = useState<DemoPlotPoint[]>([])
  const [stores, setStores]         = useState<StorePoint[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'spot' | 'mini' | 'full'>('all')
  const [showStores, setShowStores] = useState(true)
  const [mapMode, setMapMode]       = useState<'osm' | 'satellite'>('osm')

  // Multi-select store filter state
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set())
  const [storeSearch, setStoreSearch]           = useState('')
  const [dropdownOpen, setDropdownOpen]         = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // GPS user location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsTracking, setGpsTracking]   = useState(false)
  const [gpsError, setGpsError]         = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  // ── SIMOTANDI (fase tanam padi) ────────────────────────────────
  const [showFaseTanam, setShowFaseTanam]       = useState(false)
  const [showBatasKecamatan, setShowBatasKecamatan] = useState(false)
  const [periods, setPeriods]                   = useState<PeriodeOption[]>([])
  const [periodeId, setPeriodeId]               = useState<number | null>(null)
  const [rowsByKdkb, setRowsByKdkb]             = useState<Map<string, SimotandiWilayahRow>>(new Map())
  const [rowsByKdkc, setRowsByKdkc]             = useState<Map<string, SimotandiWilayahRow>>(new Map())
  const [kabGeo, setKabGeo]                     = useState<any | null>(null)
  const [kecGeo, setKecGeo]                     = useState<any | null>(null)
  const [selectedKdkb, setSelectedKdkb]         = useState<string | null>(null)
  const [selectedKdkc, setSelectedKdkc]         = useState<string | null>(null)
  const [loadingSimotandi, setLoadingSimotandi] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/demoplot-map${filterQuery}`).then(r => r.json()),
      fetch('/api/master/stores').then(r => r.json()),
    ]).then(([demoData, storeData]) => {
      setPoints(demoData ?? [])
      const validStores: StorePoint[] = (storeData ?? [])
        .filter((s: any) => s.latitude && s.longitude)
        .map((s: any) => ({ id: s.id, lat: s.latitude, lng: s.longitude, name: s.name, code: s.code, address: s.address, phone: s.phone }))
      setStores(validStores)
      setSelectedStoreIds(new Set(validStores.map(s => s.id)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [filterQuery])

  // Daftar periode + boundary kabupaten hanya diambil saat layer pertama diaktifkan
  useEffect(() => {
    if (!showFaseTanam) return

    if (periods.length === 0) {
      fetch('/api/simotandi/periods')
        .then(r => (r.ok ? r.json() : []))
        .then((data: PeriodeOption[]) => {
          const list = Array.isArray(data) ? data : []
          setPeriods(list)
          if (list.length > 0) setPeriodeId(prev => prev ?? list[0].id)
        })
        .catch(() => {})
    }

    if (!kabGeo) {
      fetch('/geojson/kabupaten.geojson')
        .then(r => (r.ok ? r.json() : null))
        .then(geo => { if (geo) setKabGeo(geo) })
        .catch(() => {})
    }
  }, [showFaseTanam, periods.length, kabGeo])

  // Tarik data fase tanam saat periode berubah
  useEffect(() => {
    if (!showFaseTanam || !periodeId) return
    let cancelled = false
    setLoadingSimotandi(true)

    fetch(`/api/simotandi/data?periode=${periodeId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return
        if (data?.kabupaten) {
          setRowsByKdkb(new Map((data.kabupaten as SimotandiWilayahRow[]).map(r => [r.kdkb as string, r])))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSimotandi(false) })

    return () => { cancelled = true }
  }, [showFaseTanam, periodeId])

  // Tarik data + boundary kecamatan saat toggle aktif & ada kabupaten terpilih
  useEffect(() => {
    if (!showBatasKecamatan || !selectedKdkb || !periodeId) {
      setKecGeo(null)
      setRowsByKdkc(new Map())
      return
    }
    let cancelled = false

    Promise.all([
      fetch(`/api/simotandi/data?periode=${periodeId}&kdkb=${selectedKdkb}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/geojson/kecamatan/${selectedKdkb}.json`).then(r => (r.ok ? r.json() : null)),
    ])
      .then(([data, geo]) => {
        if (cancelled) return
        if (data?.kecamatan) {
          setRowsByKdkc(new Map((data.kecamatan as SimotandiWilayahRow[]).map(r => [r.kdkc as string, r])))
        }
        setKecGeo(geo)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [showBatasKecamatan, selectedKdkb, periodeId])

  // Saat layer fase dimatikan, bersihkan pilihan wilayah
  useEffect(() => {
    if (!showFaseTanam) {
      setSelectedKdkb(null)
      setSelectedKdkc(null)
      setShowBatasKecamatan(false)
    }
  }, [showFaseTanam])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Region selection & filtering ───────────────────────────────
  const selectedGeometry = useMemo(() => {
    if (!selectedKdkb || !kabGeo?.features) return null
    return kabGeo.features.find((f: any) => f?.properties?.kdkb === selectedKdkb)?.geometry ?? null
  }, [selectedKdkb, kabGeo])

  const regionPoints = useMemo(
    () => (selectedGeometry ? filterPointsInGeometry(points, selectedGeometry) : points),
    [points, selectedGeometry]
  )

  const filtered = activeFilter === 'all' ? regionPoints : regionPoints.filter(p => p.type === activeFilter)

  const counts = {
    all:  regionPoints.length,
    spot: regionPoints.filter(p => p.type === 'spot').length,
    mini: regionPoints.filter(p => p.type === 'mini').length,
    full: regionPoints.filter(p => p.type === 'full').length,
  }

  const storesInRegion = useMemo(
    () => (selectedGeometry ? filterPointsInGeometry(stores, selectedGeometry) : stores),
    [stores, selectedGeometry]
  )

  const visibleStores = showStores
    ? storesInRegion.filter(s => selectedStoreIds.has(s.id))
    : []

  const filteredStoreOptions = stores.filter(s =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(storeSearch.toLowerCase()))
  )

  function toggleStore(id: string) {
    setSelectedStoreIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedStoreIds(new Set(stores.map(s => s.id))) }
  function clearAll()  { setSelectedStoreIds(new Set()) }

  // ── Agregat SIMOTANDI untuk kartu ringkasan & panel ────────────
  const selectedRow: SimotandiWilayahRow | null = useMemo(() => {
    if (selectedKdkc && rowsByKdkc.size > 0) return rowsByKdkc.get(selectedKdkc) ?? null
    if (selectedKdkb) return rowsByKdkb.get(selectedKdkb) ?? null
    return null
  }, [selectedKdkc, selectedKdkb, rowsByKdkc, rowsByKdkb])

  const summaryTotals = useMemo(() => {
    if (selectedRow) return sumRows([selectedRow])
    return sumRows(Array.from(rowsByKdkb.values()))
  }, [selectedRow, rowsByKdkb])

  const selectedRegionName = useMemo(() => {
    if (selectedKdkc) return rowsByKdkc.get(selectedKdkc)?.nama ?? selectedKdkc
    if (selectedKdkb) {
      return rowsByKdkb.get(selectedKdkb)?.nama
        ?? kabGeo?.features?.find((f: any) => f?.properties?.kdkb === selectedKdkb)?.properties?.nama
        ?? selectedKdkb
    }
    return ''
  }, [selectedKdkc, selectedKdkb, rowsByKdkc, rowsByKdkb, kabGeo])

  const regionSubtitle = useMemo(() => {
    if (selectedKdkc) return rowsByKdkb.get(selectedKdkb ?? '')?.nama ? `Kecamatan di ${rowsByKdkb.get(selectedKdkb!)!.nama}` : undefined
    if (selectedKdkb) {
      const n = kecGeo?.features?.length
      return n ? `${n} kecamatan` : undefined
    }
    return undefined
  }, [selectedKdkc, selectedKdkb, rowsByKdkb, kecGeo])

  const faseTanamProps = showFaseTanam && kabGeo
    ? {
        data: kabGeo,
        rowsByKdkb,
        selectedKdkb,
        onSelect: handleSelectKdkb,
        dataKey: `kab-${periodeId}-${selectedKdkb ?? ''}-${rowsByKdkb.size}`,
      }
    : null

  const kecamatanProps = showBatasKecamatan && kecGeo
    ? {
        data: kecGeo,
        rowsByKdkc,
        selectedKdkc,
        onSelect: handleSelectKdkc,
        dataKey: `kec-${periodeId}-${selectedKdkb ?? ''}-${rowsByKdkc.size}`,
      }
    : null

  function handleSelectKdkb(kdkb: string) {
    setSelectedKdkb(prev => (prev === kdkb ? null : kdkb))
    setSelectedKdkc(null)
  }

  function handleSelectKdkc(kdkc: string) {
    setSelectedKdkc(prev => (prev === kdkc ? null : kdkc))
  }

  function clearRegion() {
    setSelectedKdkb(null)
    setSelectedKdkc(null)
    setShowBatasKecamatan(false)
  }

  function toggleFaseTanam() {
    setShowFaseTanam(v => !v)
  }

  function toggleBatasKecamatan() {
    if (!selectedKdkb) return
    setShowBatasKecamatan(v => !v)
    if (showBatasKecamatan) setSelectedKdkc(null)
  }

  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung GPS')
      return
    }
    setGpsError(null)
    setGpsTracking(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { setGpsError('Gagal mendapatkan lokasi: ' + err.message); setGpsTracking(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
  }, [])

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setGpsTracking(false)
    setUserLocation(null)
    setGpsError(null)
  }, [])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const chip = (active: boolean, activeColor: string, activeBg: string) => ({
    padding: '0.35rem 0.9rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: 600,
    border: active ? `2px solid ${activeColor}` : '1px solid var(--border)',
    background: active ? activeBg : 'var(--surface-hover)',
    color: active ? activeColor : 'var(--text-muted)',
  }) as React.CSSProperties

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🗺️ Peta Sebaran Demo Plot</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {loading
              ? 'Memuat data...'
              : `${regionPoints.length} demo plot · ${visibleStores.length}/${stores.length} toko tampil${selectedKdkb ? ` · wilayah ${selectedRegionName}` : ''}`}
          </p>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setActiveFilter('all')} style={chip(activeFilter === 'all', '#6366f1', '#eef2ff')}>
            Semua ({counts.all})
          </button>
          {(['spot', 'mini', 'full'] as const).map(t => (
            <button key={t} onClick={() => setActiveFilter(t)} style={chip(activeFilter === t, TYPE_CONFIG[t].color, TYPE_CONFIG[t].bg)}>
              {TYPE_CONFIG[t].emoji} {TYPE_CONFIG[t].label} ({counts[t]})
            </button>
          ))}
          <button onClick={() => setShowStores(v => !v)} style={chip(showStores, '#7c3aed', '#f5f3ff')}>
            🏪 Toko ({visibleStores.length}/{stores.length})
          </button>
          <button
            onClick={() => (gpsTracking ? stopGpsTracking() : startGpsTracking())}
            style={chip(gpsTracking, '#3b82f6', '#eff6ff')}
          >
            {gpsTracking ? '📍 Lokasi Aktif' : '📍 Lokasi Saya'}
          </button>
          <button onClick={toggleFaseTanam} style={chip(showFaseTanam, '#16a34a', '#f0fdf4')}>
            🌾 Fase Tanam Padi {showFaseTanam ? 'Aktif' : ''}
          </button>
          <button
            onClick={toggleBatasKecamatan}
            disabled={!selectedKdkb}
            title={selectedKdkb ? 'Tampilkan batas kecamatan kabupaten terpilih' : 'Pilih kabupaten terlebih dahulu'}
            style={{
              ...chip(showBatasKecamatan, '#0891b2', '#ecfeff'),
              opacity: selectedKdkb ? 1 : 0.45,
              cursor: selectedKdkb ? 'pointer' : 'not-allowed',
            }}
          >
            🧭 Batas Kecamatan
          </button>
          <button
            type="button"
            onClick={() => setMapMode(m => (m === 'satellite' ? 'osm' : 'satellite'))}
            style={chip(mapMode === 'satellite', '#059669', '#ecfdf5')}
          >
            {mapMode === 'satellite' ? '🛰️ Mode Satelit (Esri)' : '🛰️ Lihat Satelit'}
          </button>
        </div>
      </div>

      {/* SIMOTANDI controls — hanya saat layer aktif */}
      {showFaseTanam && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <SimotandiPeriodSelect periods={periods} value={periodeId} onChange={setPeriodeId} loading={loadingSimotandi} />
          <SimotandiSummaryCards
            totals={summaryTotals}
            subtitle={
              selectedRow
                ? `Ringkasan wilayah ${selectedRegionName}`
                : 'Ringkasan agregat Jawa Tengah + DIY + Jawa Timur'
            }
          />
          <SimotandiLegend />
          {loadingSimotandi && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Memuat data fase tanam...</div>
          )}
        </div>
      )}

      {/* Store multi-select dropdown */}
      {showStores && stores.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-sm)',
              border: dropdownOpen ? '2px solid #7c3aed' : '1px solid #c4b5fd',
              background: '#f5f3ff', cursor: 'pointer', fontSize: '0.83rem',
              fontWeight: 600, color: '#5b21b6', width: '100%', textAlign: 'left',
            }}
          >
            <span>🏪 Filter Toko:</span>
            {selectedStoreIds.size === stores.length ? (
              <span style={{ color: '#7c3aed' }}>Semua toko ({stores.length})</span>
            ) : selectedStoreIds.size === 0 ? (
              <span style={{ color: '#b45309' }}>Tidak ada toko dipilih</span>
            ) : (
              <span style={{ color: '#5b21b6' }}>{selectedStoreIds.size} toko dipilih dari {stores.length}</span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{dropdownOpen ? '▲' : '▼'}</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', zIndex: 1000, top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', border: '1px solid #c4b5fd', borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: '320px', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #ede9fe', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={storeSearch}
                  onChange={e => setStoreSearch(e.target.value)}
                  placeholder="🔍 Cari nama atau kode toko..."
                  style={{ flex: 1, minWidth: '160px', border: '1px solid #c4b5fd', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', fontSize: '0.82rem', outline: 'none' }}
                />
                <button type="button" onClick={selectAll}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid #c4b5fd', borderRadius: '0.4rem', background: '#ede9fe', color: '#5b21b6', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Pilih Semua
                </button>
                <button type="button" onClick={clearAll}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid #fca5a5', borderRadius: '0.4rem', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Hapus Semua
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredStoreOptions.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>Tidak ada toko ditemukan.</div>
                ) : (
                  filteredStoreOptions.map(s => {
                    const checked = selectedStoreIds.has(s.id)
                    return (
                      <label key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.83rem',
                        background: checked ? '#f5f3ff' : 'transparent',
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleStore(s.id)}
                          style={{ accentColor: '#7c3aed', width: '14px', height: '14px', flexShrink: 0 }} />
                        <span style={{ fontWeight: checked ? 600 : 400, color: checked ? '#5b21b6' : 'var(--text-main)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.code && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{s.code}</span>}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {(['spot', 'mini', 'full'] as const).map(t => (
          <div key={t} onClick={() => setActiveFilter(activeFilter === t ? 'all' : t)}
            style={{
              padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              border: `1px solid ${activeFilter === t || activeFilter === 'all' ? TYPE_CONFIG[t].border : 'var(--border)'}`,
              background: activeFilter === t ? TYPE_CONFIG[t].bg : 'var(--surface)',
              transition: 'all 0.15s',
              opacity: activeFilter !== 'all' && activeFilter !== t ? 0.5 : 1,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: TYPE_CONFIG[t].textColor }}>{TYPE_CONFIG[t].label}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{TYPE_CONFIG[t].desc}</div>
              </div>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: TYPE_CONFIG[t].color, boxShadow: `0 0 0 3px ${TYPE_CONFIG[t].border}`, marginTop: '0.2rem' }} />
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '2rem', fontWeight: 800, color: TYPE_CONFIG[t].color, lineHeight: 1 }}>{counts[t]}</div>
          </div>
        ))}
        <div onClick={() => setShowStores(v => !v)}
          style={{
            padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: `1px solid ${showStores ? '#c4b5fd' : 'var(--border)'}`,
            background: showStores ? '#f5f3ff' : 'var(--surface)',
            transition: 'all 0.15s',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5b21b6' }}>Toko / Kios</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {showStores ? `${visibleStores.length} tampil` : 'Tersembunyi'}
              </div>
            </div>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 0 3px #c4b5fd', marginTop: '0.2rem' }} />
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '2rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{stores.length}</div>
        </div>
      </div>

      {/* Map + region panel */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{
          flex: selectedKdkb ? '1 1 640px' : '1 1 100%',
          minWidth: 0,
          height: 480,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#f1f5f9',
        }}>
          {!loading && (
            <MapView
              points={filtered}
              typeConfig={TYPE_CONFIG}
              storePoints={visibleStores}
              showStores={showStores}
              userLocation={userLocation}
              mapMode={mapMode}
              onToggleMapMode={() => setMapMode(m => (m === 'satellite' ? 'osm' : 'satellite'))}
              faseTanam={faseTanamProps}
              kecamatan={kecamatanProps}
            />
          )}
          {loading && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#64748b' }}>
              <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Memuat data peta...</p>
            </div>
          )}
        </div>

        {selectedKdkb && (
          <div style={{ flex: '1 1 300px', maxWidth: 380, minWidth: 280, height: 480 }}>
            <RegionDetailPanel
              nama={selectedRegionName}
              subtitle={regionSubtitle}
              row={selectedRow}
              stores={storesInRegion}
              onClear={clearRegion}
            />
          </div>
        )}
      </div>

      {/* Legend indicator */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span style={{ color: mapMode === 'satellite' ? '#047857' : '#2563eb', fontWeight: 600 }}>
          {mapMode === 'satellite' ? '🛰️ Satelit Esri (Penampakan Bumi)' : '🗺️ Peta Jalan (OSM)'}
        </span>
        <span>⭐ Spot Demo Plot — kegiatan terpisah (amber)</span>
        <span>🔵 Mini Demo Plot — 1–3 produk (biru)</span>
        <span>🟢 Full Demo Plot — ≥4 produk (hijau)</span>
        <span style={{ color: '#7c3aed', fontWeight: 600 }}>🟣 Toko/Kios (ungu)</span>
        {selectedKdkb && (
          <span style={{ color: '#0f172a', fontWeight: 600 }}>
            🔎 Filter wilayah: {selectedRegionName} ({regionPoints.length} demo plot, {storesInRegion.length} toko)
          </span>
        )}
        {gpsTracking && userLocation && (
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>📍 Lokasi Anda ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})</span>
        )}
        {gpsError && <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ {gpsError}</span>}
      </div>

      {!loading && points.length === 0 && stores.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '3rem' }}>📍</div>
          <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Belum ada data dengan koordinat GPS.</p>
        </div>
      )}
    </div>
  )
}
