'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type DemoPlotPoint = {
  id: string; lat: number; lng: number
  farmerName: string; area: string; commodity: string; foName: string
  date: string; productCount: number; products: string[]
  type: 'spot' | 'mini' | 'full'
}

type StorePoint = {
  id: string; lat: number; lng: number
  name: string; code: string | null; address: string | null; phone: string | null
}

type TypeConfig = Record<string, { label: string; desc: string; color: string; emoji: string; bg: string; border: string; textColor: string }>

interface Props {
  points: DemoPlotPoint[]
  typeConfig: TypeConfig
  storePoints?: StorePoint[]
  showStores?: boolean
  userLocation?: { lat: number; lng: number } | null
}

// Pulsing blue dot icon for user location
const userLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:24px;height:24px">
      <div style="position:absolute;top:0;left:0;width:24px;height:24px;background:rgba(59,130,246,0.25);border-radius:50%;animation:locPulse 1.5s ease-out infinite"></div>
      <div style="position:absolute;top:6px;left:6px;width:12px;height:12px;background:#3b82f6;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>
    </div>
    <style>@keyframes locPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.5);opacity:0}}</style>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// Sub-component to fly to user location when it changes
function FlyToUser({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.2 })
  }, [lat, lng, map])
  return null
}

// Jawa Tengah center
const CENTER: [number, number] = [-7.15, 110.14]

export default function MapView({ points, typeConfig, storePoints = [], showStores = true, userLocation }: Props) {
  return (
    <MapContainer
      center={CENTER}
      zoom={8}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Demo Plot markers */}
      {points.map(p => {
        const cfg = typeConfig[p.type]
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
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
            eventHandlers={{ click: (e) => e.target.openPopup() }}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontSize: '0.8rem', lineHeight: 1.5 }}>
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
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    marginTop: '0.5rem', padding: '0.35rem 0.7rem', borderRadius: '0.4rem',
                    background: '#4285F4', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                    textDecoration: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  🗺️ Arahkan ke Google Maps
                </a>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Store markers — ungu */}
      {showStores && storePoints.map(s => {
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
        return (
          <CircleMarker
            key={`store-${s.id}`}
            center={[s.lat, s.lng]}
            radius={9}
            pathOptions={{
              fillColor: '#7c3aed',
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: (e) => e.target.openPopup() }}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontSize: '0.8rem', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#7c3aed' }}>🏪 Toko / Kios</div>
                <div><strong>Nama:</strong> {s.name}</div>
                {s.code    && <div><strong>Kode:</strong> {s.code}</div>}
                {s.address && <div><strong>Alamat:</strong> {s.address}</div>}
                {s.phone   && <div><strong>Telp:</strong> {s.phone}</div>}
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    marginTop: '0.5rem', padding: '0.35rem 0.7rem', borderRadius: '0.4rem',
                    background: '#4285F4', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                    textDecoration: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  🗺️ Arahkan ke Google Maps
                </a>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* User location marker */}
      {userLocation && (
        <>
          <FlyToUser lat={userLocation.lat} lng={userLocation.lng} />
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
            <Popup>
              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, minWidth: 140 }}>
                <div style={{ fontWeight: 700, color: '#3b82f6', marginBottom: '0.2rem' }}>📍 Lokasi Anda</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  )
}
