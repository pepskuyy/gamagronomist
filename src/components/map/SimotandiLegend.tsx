'use client'

import { FASE_CONFIG, FASE_ORDER } from '@/lib/simotandi-fase'

export default function SimotandiLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '0.6rem 0.9rem',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
      }}
    >
      <strong style={{ color: 'var(--text)' }}>Legenda Fase:</strong>
      {FASE_ORDER.map((key) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: FASE_CONFIG[key].color,
              border: '1px solid rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
          />
          {FASE_CONFIG[key].label}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontStyle: 'italic' }}>
        Sumber: SIMOTANDI — Kementerian Pertanian RI
      </span>
    </div>
  )
}
