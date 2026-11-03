'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon, Satellite } from 'lucide-react'
import type { StoreImpactResult, DemoImpactSummary } from '@/lib/demoplot-impact'
import { formatKm } from '@/lib/impact-tier'

export interface MapDemoplotItem {
  id: string
  farmerName: string
  commodity: string
  date: string
  area: string
  foName: string
  latitude: number
  longitude: number
  has_impact: boolean
  productCount: number
  products: string[]
  impact?: DemoImpactSummary
}

interface Props {
  demoplots: MapDemoplotItem[]
  selectedDemoplotId: string | null
  onSelectDemoplot: (dp: MapDemoplotItem) => void
  storesInRadius?: StoreImpactResult[]
  onSelectStore?: (store: StoreImpactResult) => void
  radiusKm: number
}

function MapFlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, 12, { duration: 1.2 })
    }
  }, [center, map])
  return null
}

const CENTER_JAWA: [number, number] = [-7.55, 110.7]

export default function DemoplotImpactMapInner({
  demoplots,
  selectedDemoplotId,
  onSelectDemoplot,
  storesInRadius = [],
  onSelectStore,
  radiusKm,
}: Props) {
  const [mapMode, setMapMode] = useState<'osm' | 'satellite'>('osm')

  const selectedDp = demoplots.find((d) => d.id === selectedDemoplotId) || null
  const flyCenter = selectedDp ? ([selectedDp.latitude, selectedDp.longitude] as [number, number]) : null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      
      {/* Top Left: Basemap Switcher */}
      <div style={{ position: 'absolute', top: 12, left: 52, zIndex: 1000, display: 'flex', gap: '2px', background: 'var(--surface)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
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
          <span><span className="num" style={{ color: 'var(--text-main)' }}>{demoplots.length}</span> titik demoplot</span>
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
          minWidth: '190px',
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
          Legenda
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', border: '1.5px solid #7c3aed' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Demplot</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '1.5px solid #059669' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Demplot berdampak penjualan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', border: '1px solid #1d4ed8' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Toko dalam radius</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#059669', border: '2px solid #064e3b' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Toko berdampak penjualan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: '2px solid #b91c1c' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Demplot terpilih</span>
        </div>
      </div>

      <MapContainer
        center={CENTER_JAWA}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <MapFlyTo center={flyCenter} />

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

        {/* Lingkaran radius coverage aktif di sekitar demplot terpilih */}
        {selectedDp && (
          <Circle
            center={[selectedDp.latitude, selectedDp.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#9333ea',
              dashArray: '6, 8',
              weight: 2,
              fillColor: '#9333ea',
              fillOpacity: 0.05,
            }}
          />
        )}

        {/* Store markers dalam radius (rendered when demoplot is selected) */}
        {selectedDp &&
          storesInRadius.map((st) => {
            const isImpacted = st.has_impact
            return (
              <CircleMarker
                key={`store-${st.customer_id}`}
                center={[st.latitude, st.longitude]}
                radius={isImpacted ? 9 : 6}
                pathOptions={{
                  fillColor: isImpacted ? '#059669' : '#2563eb',
                  color: isImpacted ? '#064e3b' : '#ffffff',
                  weight: isImpacted ? 2.5 : 1.5,
                  fillOpacity: 0.95,
                }}
                eventHandlers={{
                  click: () => onSelectStore?.(st),
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                    <strong style={{ fontWeight: 600 }}>{st.name}</strong> (<span className="num">{st.distance_km}</span><span className="unit">km</span>)<br />
                    {isImpacted ? (
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                        Terdampak: +{st.impact_label}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Toko dalam radius {formatKm(radiusKm)}</span>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

        {/* Demoplot Markers */}
        {demoplots.map((dp) => {
          const isSelected = dp.id === selectedDemoplotId
          const isImpacted = dp.has_impact

          let fillColor = isImpacted ? '#10b981' : '#8b5cf6'
          let borderColor = isImpacted ? '#059669' : '#7c3aed'
          let radius = 7
          let weight = 1.5

          if (isSelected) {
            fillColor = '#ef4444'
            borderColor = '#b91c1c'
            radius = 11
            weight = 3
          }

          return (
            <CircleMarker
              key={dp.id}
              center={[dp.latitude, dp.longitude]}
              radius={radius}
              pathOptions={{
                fillColor,
                color: borderColor,
                weight,
                fillOpacity: isSelected ? 1 : 0.9,
              }}
              eventHandlers={{
                click: () => onSelectDemoplot(dp),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                  <strong style={{ fontWeight: 600 }}>{dp.farmerName}</strong> ({dp.commodity})<br />
                  <span>{dp.area} • {dp.foName}</span><br />
                  {isImpacted ? (
                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                      Berdampak pada penjualan
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{dp.date}</span>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}

      </MapContainer>
    </div>
  )
}
