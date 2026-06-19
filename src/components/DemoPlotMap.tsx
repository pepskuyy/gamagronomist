'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

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

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => (
  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b', borderRadius: 'var(--radius-md)' }}>
    🗺️ Memuat peta...
  </div>
) })

export default function DemoPlotMap({ filterQuery = '' }: { filterQuery?: string }) {
  const [points, setPoints]         = useState<DemoPlotPoint[]>([])
  const [stores, setStores]         = useState<StorePoint[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'spot' | 'mini' | 'full'>('all')
  const [showStores, setShowStores] = useState(true)

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
      // Default: select all stores
      setSelectedStoreIds(new Set(validStores.map(s => s.id)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [filterQuery])

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

  const filtered = activeFilter === 'all' ? points : points.filter(p => p.type === activeFilter)

  const counts = {
    all:  points.length,
    spot: points.filter(p => p.type === 'spot').length,
    mini: points.filter(p => p.type === 'mini').length,
    full: points.filter(p => p.type === 'full').length,
  }

  // Stores to render on map = intersection of showStores + selectedStoreIds
  const visibleStores = showStores
    ? stores.filter(s => selectedStoreIds.has(s.id))
    : []

  // Filtered store list for the dropdown search
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

  // GPS tracking
  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung GPS')
      return
    }
    setGpsError(null)
    setGpsTracking(true)

    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { setGpsError('Gagal mendapatkan lokasi: ' + err.message); setGpsTracking(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    // Then watch for updates
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🗺️ Peta Sebaran Demo Plot</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {loading ? 'Memuat data...' : `${points.length} demo plot · ${visibleStores.length}/${stores.length} toko tampil`}
          </p>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setActiveFilter('all')}
            style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
              border: activeFilter === 'all' ? '2px solid #6366f1' : '1px solid var(--border)',
              background: activeFilter === 'all' ? '#eef2ff' : 'var(--surface-hover)',
              color: activeFilter === 'all' ? '#4338ca' : 'var(--text-muted)',
            }}>
            Semua ({counts.all})
          </button>
          {(['spot', 'mini', 'full'] as const).map(t => (
            <button key={t}
              onClick={() => setActiveFilter(t)}
              style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
                border: activeFilter === t ? `2px solid ${TYPE_CONFIG[t].color}` : '1px solid var(--border)',
                background: activeFilter === t ? TYPE_CONFIG[t].bg : 'var(--surface-hover)',
                color: activeFilter === t ? TYPE_CONFIG[t].textColor : 'var(--text-muted)',
              }}>
              {TYPE_CONFIG[t].emoji} {TYPE_CONFIG[t].label} ({counts[t]})
            </button>
          ))}
          {/* Store toggle */}
          <button
            onClick={() => setShowStores(v => !v)}
            style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
              border: showStores ? '2px solid #7c3aed' : '1px solid var(--border)',
              background: showStores ? '#f5f3ff' : 'var(--surface-hover)',
              color: showStores ? '#5b21b6' : 'var(--text-muted)',
            }}>
            🏪 Toko ({visibleStores.length}/{stores.length})
          </button>

          {/* My Location button */}
          <button
            onClick={() => gpsTracking ? stopGpsTracking() : startGpsTracking()}
            style={{
              padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
              border: gpsTracking ? '2px solid #3b82f6' : '1px solid var(--border)',
              background: gpsTracking ? '#eff6ff' : 'var(--surface-hover)',
              color: gpsTracking ? '#1d4ed8' : 'var(--text-muted)',
              animation: gpsTracking ? 'none' : undefined,
            }}
          >
            {gpsTracking ? '📍 Lokasi Aktif' : '📍 Lokasi Saya'}
          </button>
        </div>
      </div>

      {/* Store multi-select dropdown (visible only when showStores = true) */}
      {showStores && stores.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          {/* Trigger button */}
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

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', zIndex: 1000, top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', border: '1px solid #c4b5fd', borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: '320px', display: 'flex', flexDirection: 'column',
            }}>
              {/* Search + Select All / Clear All */}
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #ede9fe', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={storeSearch}
                  onChange={e => setStoreSearch(e.target.value)}
                  placeholder="🔍 Cari nama atau kode toko..."
                  style={{ flex: 1, minWidth: '160px', border: '1px solid #c4b5fd', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', fontSize: '0.82rem', outline: 'none' }}
                />
                <button
                  type="button" onClick={selectAll}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid #c4b5fd', borderRadius: '0.4rem', background: '#ede9fe', color: '#5b21b6', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Pilih Semua
                </button>
                <button
                  type="button" onClick={clearAll}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid #fca5a5', borderRadius: '0.4rem', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Hapus Semua
                </button>
              </div>

              {/* Store list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredStoreOptions.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>Tidak ada toko ditemukan.</div>
                ) : (
                  filteredStoreOptions.map(s => {
                    const checked = selectedStoreIds.has(s.id)
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.83rem',
                          background: checked ? '#f5f3ff' : 'transparent',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background 0.1s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStore(s.id)}
                          style={{ accentColor: '#7c3aed', width: '14px', height: '14px', flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: checked ? 600 : 400, color: checked ? '#5b21b6' : 'var(--text-main)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.code && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{s.code}</span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stat cards — demo plot types + toko */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {(['spot', 'mini', 'full'] as const).map(t => (
          <div key={t} onClick={() => setActiveFilter(activeFilter === t ? 'all' : t)}
            style={{ padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
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
        {/* Toko card */}
        <div onClick={() => setShowStores(v => !v)}
          style={{ padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
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

      {/* Map */}
      <div style={{ height: 480, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: '#f1f5f9' }}>
        {!loading && (
          <MapView points={filtered} typeConfig={TYPE_CONFIG} storePoints={visibleStores} showStores={showStores} userLocation={userLocation} />
        )}
        {loading && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#64748b' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Memuat data peta...</p>
          </div>
        )}
      </div>

      {/* Legend indicator */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span>⭐ Spot Demo Plot — kegiatan terpisah (amber)</span>
        <span>🔵 Mini Demo Plot — 1–3 produk (biru)</span>
        <span>🟢 Full Demo Plot — ≥4 produk (hijau)</span>
        <span style={{ color: '#7c3aed', fontWeight: 600 }}>🟣 Toko/Kios (ungu)</span>
        {gpsTracking && userLocation && (
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>📍 Lokasi Anda ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})</span>
        )}
        {gpsError && (
          <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ {gpsError}</span>
        )}
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
