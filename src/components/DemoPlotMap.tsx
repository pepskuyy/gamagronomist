'use client'

import { useEffect, useState, useCallback } from 'react'
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

const TYPE_CONFIG = {
  spot: {
    label: 'Spot Demo Plot',
    desc: '1 produk',
    color: '#f59e0b',
    emoji: '⭐',
    bg: '#fffbeb',
    border: '#fcd34d',
    textColor: '#92400e',
  },
  mini: {
    label: 'Mini Demo Plot',
    desc: '2–3 produk',
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

// Dynamically import map to prevent SSR errors
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => (
  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b', borderRadius: 'var(--radius-md)' }}>
    🗺️ Memuat peta...
  </div>
) })

export default function DemoPlotMap() {
  const [points, setPoints] = useState<DemoPlotPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'spot' | 'mini' | 'full'>('all')

  useEffect(() => {
    fetch('/api/demoplot-map')
      .then(r => r.json())
      .then(data => { setPoints(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = activeFilter === 'all' ? points : points.filter(p => p.type === activeFilter)

  const counts = {
    all: points.length,
    spot: points.filter(p => p.type === 'spot').length,
    mini: points.filter(p => p.type === 'mini').length,
    full: points.filter(p => p.type === 'full').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🗺️ Peta Sebaran Demo Plot</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {loading ? 'Memuat data...' : `${points.length} demo plot tercatat dengan koordinat GPS`}
          </p>
        </div>

        {/* Type legend chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* All filter */}
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
              border: activeFilter === 'all' ? '2px solid #6366f1' : '1px solid var(--border)',
              background: activeFilter === 'all' ? '#eef2ff' : 'var(--surface-hover)',
              color: activeFilter === 'all' ? '#4338ca' : 'var(--text-muted)',
            }}>
            Semua ({counts.all})
          </button>
          {(['spot', 'mini', 'full'] as const).map(t => (
            <button key={t}
              onClick={() => setActiveFilter(t)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
                border: activeFilter === t ? `2px solid ${TYPE_CONFIG[t].color}` : '1px solid var(--border)',
                background: activeFilter === t ? TYPE_CONFIG[t].bg : 'var(--surface-hover)',
                color: activeFilter === t ? TYPE_CONFIG[t].textColor : 'var(--text-muted)',
              }}>
              {TYPE_CONFIG[t].emoji} {TYPE_CONFIG[t].label} ({counts[t]})
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
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
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: TYPE_CONFIG[t].color,
                boxShadow: `0 0 0 3px ${TYPE_CONFIG[t].border}`,
                marginTop: '0.2rem'
              }} />
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '2rem', fontWeight: 800, color: TYPE_CONFIG[t].color, lineHeight: 1 }}>
              {counts[t]}
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ height: 480, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: '#f1f5f9' }}>
        {!loading && (
          <MapView points={filtered} typeConfig={TYPE_CONFIG} />
        )}
        {loading && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#64748b' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Memuat data peta...</p>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && points.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '3rem' }}>📍</div>
          <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Belum ada demo plot dengan data GPS.</p>
          <p style={{ fontSize: '0.85rem' }}>Aktifkan GPS saat melakukan realisasi demo plot agar data dapat dipetakan.</p>
        </div>
      )}
    </div>
  )
}
