'use client'

import { useState } from 'react'

export type GpsStatus = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  onCapture: (lat: number, lng: number) => void
  onClear?: () => void
}

export default function GpsCapture({ onCapture, onClear }: Props) {
  const [status, setStatus] = useState<GpsStatus>('idle')
  const [lat, setLat]       = useState<number | null>(null)
  const [lng, setLng]       = useState<number | null>(null)

  function capture() {
    if (!navigator.geolocation) { setStatus('error'); return }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setStatus('success')
        onCapture(pos.coords.latitude, pos.coords.longitude)
      },
      () => setStatus('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  function clear() {
    setStatus('idle')
    setLat(null)
    setLng(null)
    onClear?.()
  }

  const borderColor = { idle: 'var(--border)', loading: '#fbbf24', success: '#22c55e', error: '#ef4444' }[status]

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 'var(--radius-sm)',
      padding: '1rem 1.25rem',
      background: status === 'success' ? '#f0fdf4' : status === 'error' ? '#fff1f2' : 'var(--surface-2)',
      transition: 'border-color 0.2s, background 0.2s',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.75rem',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <span>📍 Lokasi GPS</span>
          {status === 'idle'    && <span className="badge badge-neutral">Belum Diambil</span>}
          {status === 'loading' && <span className="badge badge-warning">Mencari...</span>}
          {status === 'success' && <span className="badge badge-success">Berhasil</span>}
          {status === 'error'   && <span className="badge badge-danger">Gagal</span>}
        </div>

        {status === 'success' && lat !== null && lng !== null && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>
            <span style={{ fontFamily: 'monospace', color: '#16a34a' }}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
            {' '}
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
              style={{ color: '#0ea5e9', fontSize: '0.78rem' }}>
              Lihat di Maps ↗
            </a>
          </div>
        )}
        {status === 'error' && (
          <p style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#dc2626' }}>
            Izin lokasi ditolak atau tidak tersedia. Pastikan GPS aktif dan izinkan akses.
          </p>
        )}
        {status === 'idle' && (
          <p style={{ marginTop: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Lokasi wajib diisi sebelum mengirim laporan.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {status === 'success' && (
          <button type="button" onClick={clear}
            className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
            🔄 Ulang
          </button>
        )}
        <button type="button" onClick={capture} disabled={status === 'loading'}
          className={status === 'success' ? 'btn btn-outline' : 'btn btn-primary'}
          style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
          {status === 'loading' ? '⏳ Mencari...' : status === 'success' ? '✓ Sudah Diambil' : '📍 Ambil Lokasi'}
        </button>
      </div>
    </div>
  )
}
