'use client'

import { useState } from 'react'
import { RADIUS_PRESETS, formatKm, HELP_RADIUS } from '@/lib/impact-tier'

interface Props {
  defaultRadius: number
  activeRadius: number
  isOverride: boolean
  canEdit: boolean
  onChange: (radiusKm: number | null) => void // null = kembali ke default
  onOpenSettings: () => void
}

const MIN = 0.5
const MAX = 20

function parseInput(v: string): number | null {
  const n = Number(v.trim().replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const r = Math.round(n * 100) / 100
  return r >= MIN && r <= MAX ? r : null
}

export default function RadiusCoverageBar({ defaultRadius, activeRadius, isOverride, canEdit, onChange, onOpenSettings }: Props) {
  const [custom, setCustom] = useState('')
  const [invalid, setInvalid] = useState(false)

  const chips = RADIUS_PRESETS.includes(activeRadius) ? RADIUS_PRESETS : [...RADIUS_PRESETS, activeRadius]

  const applyCustom = () => {
    if (!custom.trim()) return
    const r = parseInput(custom)
    if (r === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setCustom('')
    onChange(r === defaultRadius ? null : r)
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.7rem',
    borderRadius: '9999px',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: active ? '1px solid #7c3aed' : '1px solid var(--border)',
    background: active ? '#7c3aed' : '#ffffff',
    color: active ? '#ffffff' : '#334155',
    whiteSpace: 'nowrap',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 0.75rem',
        padding: '0.65rem 0.9rem',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }} title={HELP_RADIUS(formatKm(activeRadius))}>
        📍 Radius coverage <span style={{ color: '#94a3b8', fontWeight: 600 }}>ⓘ</span>
      </span>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {chips.map((km) => (
          <button
            key={km}
            type="button"
            style={chipStyle(km === activeRadius)}
            onClick={() => onChange(km === defaultRadius ? null : km)}
          >
            {formatKm(km)}
            {km === defaultRadius ? ' (default)' : ''}
          </button>
        ))}
        <input
          type="text"
          inputMode="decimal"
          placeholder="km lain"
          value={custom}
          aria-label="Radius lain dalam km"
          aria-invalid={invalid}
          title={invalid ? 'Radius harus antara 0,5 dan 20 km' : undefined}
          onChange={(e) => {
            setCustom(e.target.value)
            setInvalid(false)
          }}
          onBlur={applyCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyCustom()
          }}
          style={{
            width: '78px',
            padding: '0.3rem 0.55rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            border: invalid ? '1px solid #dc2626' : '1px solid var(--border)',
            outline: 'none',
          }}
        />
      </div>

      {isOverride && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 700 }}
        >
          ↺ Kembali ke default
        </button>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isOverride ? `Tampilan sementara — default tetap ${formatKm(defaultRadius)}` : `Default ${formatKm(defaultRadius)}`}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: '0.3rem 0.7rem',
              borderRadius: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: '#334155',
              whiteSpace: 'nowrap',
            }}
          >
            ⚙ Ubah default
          </button>
        )}
      </div>
    </div>
  )
}
