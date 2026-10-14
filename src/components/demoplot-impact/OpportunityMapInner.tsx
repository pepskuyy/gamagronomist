'use client'

import { useEffect, useState, Fragment } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { OpportunityZone, ZoneStoreItem } from '@/lib/demoplot-opportunity'

interface Props {
  zones: OpportunityZone[]
  selectedZoneId: string | null
  onSelectZone: (zone: OpportunityZone) => void
  onSelectStore?: (store: ZoneStoreItem) => void
}

function MapFlyTo({ center, zoom = 12 }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.2 })
    }
  }, [center, zoom, map])
  return null
}

const CENTER_JAWA: [number, number] = [-7.55, 110.7]

export default function OpportunityMapInner({
  zones,
  selectedZoneId,
  onSelectZone,
  onSelectStore,
}: Props) {
  const [mapMode, setMapMode] = useState<'osm' | 'satellite'>('osm')

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null
  const flyCenter = selectedZone
    ? ([selectedZone.centroid.latitude, selectedZone.centroid.longitude] as [number, number])
    : null

  const getZoneColor = (zone: OpportunityZone, isSelected: boolean) => {
    switch (zone.urgency_badge_color) {
      case 'red':
        return {
          stroke: isSelected ? '#b91c1c' : '#ef4444',
          fill: '#f87171',
          fillOpacity: isSelected ? 0.25 : 0.14,
        }
      case 'amber':
        return {
          stroke: isSelected ? '#b45309' : '#f59e0b',
          fill: '#fbbf24',
          fillOpacity: isSelected ? 0.24 : 0.12,
        }
      case 'emerald':
        return {
          stroke: isSelected ? '#047857' : '#10b981',
          fill: '#34d399',
          fillOpacity: isSelected ? 0.22 : 0.1,
        }
      default:
        return {
          stroke: isSelected ? '#1d4ed8' : '#3b82f6',
          fill: '#60a5fa',
          fillOpacity: isSelected ? 0.22 : 0.12,
        }
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '540px',
        borderRadius: 'var(--radius-lg, 0.75rem)',
        overflow: 'hidden',
      }}
    >
      {/* Top Left: Basemap Switcher */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 52,
          zIndex: 1000,
          display: 'flex',
          gap: '0.25rem',
          background: 'rgba(255,255,255,0.95)',
          padding: '3px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <button
          type="button"
          onClick={() => setMapMode('osm')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: mapMode === 'osm' ? '#0f172a' : 'transparent',
            color: mapMode === 'osm' ? '#ffffff' : '#475569',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          🗺️ Peta
        </button>
        <button
          type="button"
          onClick={() => setMapMode('satellite')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: mapMode === 'satellite' ? '#0f172a' : 'transparent',
            color: mapMode === 'satellite' ? '#ffffff' : '#475569',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          🛰️ Satelit
        </button>
      </div>

      {/* Top Right: Count Badge */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            padding: '0.45rem 0.9rem',
            borderRadius: '9999px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#1e293b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            border: '1px solid #e2e8f0',
          }}
        >
          <span>🎯</span>
          <span>{zones.length} Zona Rekomendasi Terdeteksi</span>
        </div>
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 12,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(4px)',
          borderRadius: '0.65rem',
          padding: '0.75rem 0.95rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          border: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          minWidth: '220px',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          LEGENDA REKOMENDASI
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ef4444',
              border: '2px solid #b91c1c',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 600 }}>
            Zona Urgensi: Kawal Sell-Out (Merah)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#f59e0b',
              border: '2px solid #d97706',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 500 }}>
            Zona Potensial / Penetrasi (Oranye/Kuning)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#10b981',
              border: '1.5px solid #059669',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 500 }}>
            Zona Terawat (Baru ada demplot)
          </span>
        </div>

        <div
          style={{
            height: '1px',
            background: '#e2e8f0',
            margin: '0.2rem 0',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: '#ea580c',
              border: '2px solid #7c2d12',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 600 }}>
            ⭐ Toko Berstok Produk Fokus
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#3b82f6',
              border: '1px solid #1d4ed8',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 500 }}>
            🏪 Kios Sekitar (Spillover)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#8b5cf6',
              border: '1px solid #6d28d9',
            }}
          />
          <span style={{ color: '#334155', fontWeight: 500 }}>
            🌾 Demplot Lalu Terdekat
          </span>
        </div>
      </div>

      <MapContainer
        center={CENTER_JAWA}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <MapFlyTo center={flyCenter} zoom={12} />

        {mapMode === 'satellite' ? (
          <>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri"
              maxZoom={19}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </>
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}

        {/* 1. RENDER SEMUA ZONA (LINGKARAN RADIUS 5 KM & TITIK PUSAT) */}
        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId
          const style = getZoneColor(zone, isSelected)

          return (
            <Fragment key={zone.id}>
              {/* Lingkaran Radius 5km */}
              <Circle
                center={[zone.centroid.latitude, zone.centroid.longitude]}
                radius={zone.radius_km * 1000}
                pathOptions={{
                  color: style.stroke,
                  weight: isSelected ? 3 : 1.5,
                  fillColor: style.fill,
                  fillOpacity: style.fillOpacity,
                  dashArray: isSelected ? undefined : '5, 8',
                }}
                eventHandlers={{
                  click: () => onSelectZone(zone),
                }}
              />

              {/* Titik Pusat Rekomendasi (Centroid Marker) */}
              <CircleMarker
                center={[zone.centroid.latitude, zone.centroid.longitude]}
                radius={isSelected ? 14 : 10}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: style.stroke,
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: () => onSelectZone(zone),
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                      #{zone.rank} {zone.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                      Skor: <strong>{zone.score}/100</strong> • {zone.urgency_label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {zone.stocked_stores_count} Toko Berstok • {zone.total_stores_in_radius} Total Kios
                    </div>
                  </div>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 220, fontSize: '0.85rem' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: style.stroke,
                        color: '#ffffff',
                        marginBottom: '0.4rem',
                      }}
                    >
                      Peringkat #{zone.rank} • Skor {zone.score}/100
                    </div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 800 }}>
                      {zone.title}
                    </h4>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                      {zone.action_summary}
                    </p>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', fontSize: '0.75rem' }}>
                      <div>
                        🏪 Toko berstok produk fokus: <strong>{zone.stocked_stores_count} toko</strong>
                      </div>
                      <div>
                        📦 Nilai stok produk sales: <strong>Rp {zone.total_dev_stock_omset.toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        🌾 Demplot terakhir:{' '}
                        <strong>
                          {zone.last_demoplot_days_ago !== null
                            ? `${zone.last_demoplot_days_ago} hari lalu`
                            : 'Nihil (Belum pernah)'}
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectZone(zone)}
                      style={{
                        marginTop: '0.6rem',
                        width: '100%',
                        padding: '0.4rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Lihat Rincian Rekomendasi
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          )
        })}

        {/* 2. RENDER TOKO & DEMPLOT DI ZONA TERPILIH */}
        {selectedZone && (
          <>
            {/* Toko-toko di dalam zona */}
            {selectedZone.stores.map((store) => {
              const hasStock = store.has_dev_stock

              return (
                <CircleMarker
                  key={store.id}
                  center={[store.latitude, store.longitude]}
                  radius={hasStock ? 9 : 6}
                  pathOptions={{
                    color: hasStock ? '#7c2d12' : '#1d4ed8',
                    weight: hasStock ? 2.5 : 1.5,
                    fillColor: hasStock ? '#ea580c' : '#3b82f6',
                    fillOpacity: 0.95,
                  }}
                  eventHandlers={{
                    click: () => onSelectStore && onSelectStore(store),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <div style={{ fontSize: '0.78rem' }}>
                      <div style={{ fontWeight: 700, color: hasStock ? '#c2410c' : '#1e40af' }}>
                        {hasStock ? '⭐ ' : '🏪 '}
                        {store.name}
                      </div>
                      <div>Jarak dari pusat zona: {store.distance_km} km</div>
                      {hasStock ? (
                        <div style={{ color: '#b45309', fontWeight: 600 }}>
                          Stok: Rp {store.total_dev_omset.toLocaleString('id-ID')} (
                          {store.stocked_items.map((it) => it.product_name).join(', ')})
                        </div>
                      ) : (
                        <div style={{ color: '#64748b' }}>Belum memasok produk fokus</div>
                      )}
                      {store.default_salesman && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Sales: {store.default_salesman}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              )
            })}

            {/* Riwayat Demplot Terdekat di dalam zona */}
            {selectedZone.nearby_demoplots.map((dp) => (
              <CircleMarker
                key={dp.id}
                center={[
                  // Jika ada koordinat, gunakan sedikit offset jika sama persis
                  selectedZone.centroid.latitude,
                  selectedZone.centroid.longitude,
                ]}
                radius={7}
                pathOptions={{
                  color: '#5b21b6',
                  weight: 2,
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="bottom" offset={[0, 8]}>
                  <div style={{ fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#6d28d9' }}>
                      🌾 Demplot: {dp.farmer_name}
                    </div>
                    <div>Komoditas: {dp.commodity}</div>
                    <div>Tanggal: {dp.date}</div>
                    <div>Jarak: {dp.distance_km} km</div>
                    {dp.products.length > 0 && (
                      <div style={{ color: '#475569' }}>
                        Produk: {dp.products.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  )
}
