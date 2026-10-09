'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { StoreImpactResult } from '@/lib/demoplot-impact'

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
}

interface Props {
  demoplots: MapDemoplotItem[]
  selectedDemoplotId: string | null
  onSelectDemoplot: (dp: MapDemoplotItem) => void
  storesInRadius?: StoreImpactResult[]
  onSelectStore?: (store: StoreImpactResult) => void
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
}: Props) {
  const [mapMode, setMapMode] = useState<'osm' | 'satellite'>('osm')

  const selectedDp = demoplots.find((d) => d.id === selectedDemoplotId) || null
  const flyCenter = selectedDp ? ([selectedDp.latitude, selectedDp.longitude] as [number, number]) : null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      
      {/* Top Left: Basemap Switcher */}
      <div style={{ position: 'absolute', top: 12, left: 52, zIndex: 1000, display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.95)', padding: '3px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
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
            padding: '0.4rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#1e293b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            border: '1px solid #e2e8f0',
          }}
        >
          <span>🌾</span>
          <span>{demoplots.length} titik demoplot</span>
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
          minWidth: '190px',
        }}
      >
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          LEGENDA
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', border: '1.5px solid #7c3aed' }} />
          <span style={{ color: '#334155', fontWeight: 500 }}>Demplot</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '1.5px solid #059669' }} />
          <span style={{ color: '#334155', fontWeight: 500 }}>Demplot berdampak penjualan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', border: '1px solid #1d4ed8' }} />
          <span style={{ color: '#334155', fontWeight: 500 }}>Toko dalam radius</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#059669', border: '2px solid #064e3b' }} />
          <span style={{ color: '#334155', fontWeight: 600 }}>Toko berdampak penjualan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: '2px solid #b91c1c' }} />
          <span style={{ color: '#334155', fontWeight: 600 }}>Demplot terpilih</span>
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

        {/* 5 km Radius Circle around selected demoplot */}
        {selectedDp && (
          <Circle
            center={[selectedDp.latitude, selectedDp.longitude]}
            radius={5000}
            pathOptions={{
              color: '#9333ea',
              dashArray: '6, 8',
              weight: 2,
              fillColor: '#9333ea',
              fillOpacity: 0.05,
            }}
          />
        )}

        {/* Store markers in 5 km radius (rendered when demoplot is selected) */}
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
                    <strong>{st.name}</strong> ({st.distance_km} km)<br />
                    {isImpacted ? (
                      <span style={{ color: '#15803d', fontWeight: 700 }}>
                        ⭐ Terdampak: +{st.impact_total_qty} PCS
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Toko dalam radius 5 km</span>
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
                  <strong>{dp.farmerName}</strong> ({dp.commodity})<br />
                  <span>📍 {dp.area} • {dp.foName}</span><br />
                  {isImpacted ? (
                    <span style={{ color: '#15803d', fontWeight: 700 }}>
                      🌿 Berdampak pada penjualan
                    </span>
                  ) : (
                    <span style={{ color: '#64748b' }}>📅 {dp.date}</span>
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
