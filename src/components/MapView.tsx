'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type DemoPlotPoint = {
  id: string; lat: number; lng: number
  farmerName: string; area: string; commodity: string; foName: string
  date: string; productCount: number; products: string[]
  type: 'spot' | 'mini' | 'full'
}
type TypeConfig = Record<string, { label: string; desc: string; color: string; emoji: string; bg: string; border: string; textColor: string }>

interface Props {
  points: DemoPlotPoint[]
  typeConfig: TypeConfig
}

// Jawa Tengah center
const CENTER: [number, number] = [-7.15, 110.14]

export default function MapView({ points, typeConfig }: Props) {
  return (
    <MapContainer
      center={CENTER}
      zoom={8}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
    >
      {/* Satellite tile layer (OpenTopoMap as free alternative — clean) */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {points.map(p => {
        const cfg = typeConfig[p.type]
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.type === 'full' ? 10 : p.type === 'mini' ? 8 : 6}
            pathOptions={{
              fillColor: cfg.color,
              color: '#fff',
              weight: 1.5,
              fillOpacity: 0.85,
            }}
          >
            <Tooltip>
              <div style={{ minWidth: '180px', fontSize: '0.8rem', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{cfg.emoji} {cfg.label}</div>
                <div>🌾 <strong>Petani:</strong> {p.farmerName}</div>
                <div>📍 <strong>Area:</strong> {p.area}</div>
                <div>🌱 <strong>Komoditas:</strong> {p.commodity}</div>
                <div>👤 <strong>FO:</strong> {p.foName}</div>
                <div>🧪 <strong>Produk ({p.productCount}):</strong></div>
                {p.products.length > 0 && (
                  <ul style={{ paddingLeft: '1rem', margin: '0.15rem 0 0', listStyle: 'disc' }}>
                    {p.products.slice(0, 5).map((pr, i) => <li key={i}>{pr}</li>)}
                    {p.products.length > 5 && <li>+{p.products.length - 5} lainnya</li>}
                  </ul>
                )}
                <div style={{ marginTop: '0.35rem', color: '#6b7280' }}>
                  📅 {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(p.date))}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
