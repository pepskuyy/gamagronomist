'use client'

export type PeriodeOption = { id: number; kode: string; label: string }

export default function SimotandiPeriodSelect({
  periods,
  value,
  onChange,
  loading,
}: {
  periods: PeriodeOption[]
  value: number | null
  onChange: (id: number) => void
  loading?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
        Periode SIMOTANDI
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={loading || periods.length === 0}
        style={{
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          padding: '0.4rem 0.65rem',
          fontSize: '0.85rem',
          color: '#374151',
          background: '#fff',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 260,
          maxWidth: '100%',
        }}
      >
        {periods.length === 0 && <option value="">Belum ada data periode</option>}
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  )
}
