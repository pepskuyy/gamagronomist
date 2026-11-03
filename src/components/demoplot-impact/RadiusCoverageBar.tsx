'use client'

import { useState } from 'react'
import { Info, MapPin, RotateCcw, Settings } from 'lucide-react'
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
    padding: '0.25rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? '#ffffff' : 'var(--text-secondary)',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 0.75rem',
        padding: '0.75rem 1rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }} title={HELP_RADIUS(formatKm(activeRadius))}>
        <MapPin size={16} strokeWidth={1.75} className="icon-inline" /> Radius coverage <Info size={14} strokeWidth={1.75} style={{ color: 'var(--text-light)' }} />
      </span>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
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
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            border: invalid ? '1px solid var(--danger)' : '1px solid var(--border)',
            outline: 'none',
          }}
        />
      </div>

      {isOverride && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <RotateCcw size={14} strokeWidth={1.75} /> Kembali ke default
        </button>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isOverride ? `Tampilan sementara — default tetap ${formatKm(defaultRadius)}` : `Default ${formatKm(defaultRadius)}`}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <Settings size={14} strokeWidth={1.75} /> Ubah default
          </button>
        )}
      </div>
    </div>
  )
}
