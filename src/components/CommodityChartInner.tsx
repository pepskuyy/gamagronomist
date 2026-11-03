'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Item = { name: string; count: number; pct: number }

interface Props {
  items: Item[]
  palette: string[]
  total: number
  label?: string
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) => {
  if (pct < 5) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct}%
    </text>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', boxShadow: 'var(--shadow-md)', fontSize: '0.82rem' }}>
        <div style={{ fontWeight: 500, marginBottom: '0.125rem', color: 'var(--text-main)' }}>{d.name}</div>
        <div className="num" style={{ color: 'var(--text-muted)' }}>{d.count} data · {d.pct}%</div>
      </div>
    )
  }
  return null
}

export default function CommodityChartInner({ items, palette, total, label = 'Customer Behavior' }: Props) {
  return (
    <div style={{ position: 'relative', width: 280, height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            paddingAngle={2}
            dataKey="count"
            labelLine={false}
            label={renderCustomLabel}
          >
            {items.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none'
      }}>
        <div className="num" style={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1, color: 'var(--text-main)' }}>{total}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{label}</div>
      </div>
    </div>
  )
}
