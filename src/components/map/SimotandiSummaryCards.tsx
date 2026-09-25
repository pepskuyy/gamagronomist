'use client'

import { FaseKey, SUMMARY_GROUPS, formatHa } from '@/lib/simotandi-fase'

export default function SimotandiSummaryCards({
  totals,
  subtitle,
}: {
  totals: Record<FaseKey, number>
  subtitle?: string
}) {
  return (
    <div>
      {subtitle && (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
        {SUMMARY_GROUPS.map((g) => {
          const value = g.keys.reduce((a, k) => a + (totals[k] ?? 0), 0)
          return (
            <div
              key={g.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.7rem 0.85rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${g.color}`,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>{g.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.1, color: g.color }}>
                  {formatHa(value)}
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>Ha</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{g.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
