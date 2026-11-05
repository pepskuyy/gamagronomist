'use client'

import { useEffect, useState, Fragment } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon, Package, Satellite, Sprout, Star, Store, Target } from 'lucide-react'
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
          gap: '2px',
          background: 'var(--surface)',
          padding: '2px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={() => setMapMode('osm')}
          style={{
            padding: '0.25rem 0.625rem',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: 500,
            background: mapMode === 'osm' ? 'var(--surface-3)' : 'transparent',
            color: mapMode === 'osm' ? 'var(--text-main)' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <MapIcon size={14} strokeWidth={1.75} /> Peta
        </button>
        <button
          type="button"
          onClick={() => setMapMode('satellite')}
          style={{
            padding: '0.25rem 0.625rem',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: 500,
            background: mapMode === 'satellite' ? 'var(--surface-3)' : 'transparent',
            color: mapMode === 'satellite' ? 'var(--text-main)' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Satellite size={14} strokeWidth={1.75} /> Satelit
        </button>
      </div>

      {/* Top Right: Count Badge */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
        <div
          style={{
            background: 'var(--surface)',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            border: '1px solid var(--border)',
          }}
        >
          <Target size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
          <span><span className="num" style={{ color: 'var(--text-main)' }}>{zones.length}</span> Zona Rekomendasi Terdeteksi</span>
        </div>
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 12,
          zIndex: 1000,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border)',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          minWidth: '220px',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
          }}
        >
          Legenda rekomendasi
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
          <span style={{ color: 'var(--text-secondary)' }}>
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
          <span style={{ color: 'var(--text-secondary)' }}>
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
          <span style={{ color: 'var(--text-secondary)' }}>
            Zona Terawat (Baru ada demplot)
          </span>
        </div>

        <div
          style={{
            height: '1px',
            background: 'var(--border)',
            margin: '0.25rem 0',
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
          <span style={{ color: 'var(--text-secondary)' }}>
            Toko Berstok Produk Fokus
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
          <span style={{ color: 'var(--text-secondary)' }}>
            Kios Sekitar (Spillover)
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
          <span style={{ color: 'var(--text-secondary)' }}>
            Demplot Lalu Terdekat
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
                radius={isSelected ? 10 : 7}
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
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      #{zone.rank} {zone.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Skor: <strong className="num" style={{ fontWeight: 600 }}>{zone.score}/100</strong> • {zone.urgency_label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {zone.stocked_stores_count} Toko Berstok • {zone.total_stores_in_radius} Total Kios
                    </div>
                  </div>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 220, fontSize: '0.85rem' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: style.stroke,
                        color: '#ffffff',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Peringkat #{zone.rank} • Skor {zone.score}/100
                    </div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>
                      {zone.title}
                    </h4>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {zone.action_summary}
                    </p>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Store size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> <span>Toko berstok produk fokus: <strong className="num" style={{ fontWeight: 600 }}>{zone.stocked_stores_count}</strong><span className="unit">toko</span></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Package size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> <span>Nilai stok produk sales: <strong className="num" style={{ fontWeight: 600 }}>Rp {zone.total_dev_stock_omset.toLocaleString('id-ID')}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Sprout size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> <span>Demplot terakhir:{' '}
                        <strong style={{ fontWeight: 600 }}>
                          {zone.last_demoplot_days_ago !== null
                            ? `${zone.last_demoplot_days_ago} hari lalu`
                            : 'Nihil (Belum pernah)'}
                        </strong></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectZone(zone)}
                      style={{
                        marginTop: '0.5rem',
                        width: '100%',
                        padding: '0.375rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'var(--text-main)',
                        color: '#ffffff',
                        fontWeight: 500,
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
                  radius={hasStock ? 6 : 4}
                  pathOptions={{
                    color: hasStock ? '#7c2d12' : '#1d4ed8',
                    weight: hasStock ? 2 : 1,
                    fillColor: hasStock ? '#ea580c' : '#3b82f6',
                    fillOpacity: 0.95,
                  }}
                  eventHandlers={{
                    click: () => onSelectStore && onSelectStore(store),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <div style={{ fontSize: '0.78rem' }}>
                      <div style={{ fontWeight: 600, color: hasStock ? 'var(--warning)' : 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {hasStock ? <Star size={12} strokeWidth={1.75} fill="currentColor" /> : <Store size={12} strokeWidth={1.75} />}
                        {store.name}
                      </div>
                      <div>Jarak dari pusat zona: <span className="num">{store.distance_km}</span><span className="unit">km</span></div>
                      {hasStock ? (
                        <div className="num" style={{ color: 'var(--warning)', fontWeight: 500 }}>
                          Stok: Rp {store.total_dev_omset.toLocaleString('id-ID')} (
                          {store.stocked_items.map((it) => it.product_name).join(', ')})
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)' }}>Belum memasok produk fokus</div>
                      )}
                      {store.default_salesman && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                radius={5}
                pathOptions={{
                  color: '#5b21b6',
                  weight: 2,
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="bottom" offset={[0, 8]}>
                  <div style={{ fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Sprout size={12} strokeWidth={1.75} /> Demplot: {dp.farmer_name}
                    </div>
                    <div>Komoditas: {dp.commodity}</div>
                    <div>Tanggal: {dp.date}</div>
                    <div>Jarak: <span className="num">{dp.distance_km}</span><span className="unit">km</span></div>
                    {dp.products.length > 0 && (
                      <div style={{ color: 'var(--text-secondary)' }}>
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
