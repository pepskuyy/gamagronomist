'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Item = { name: string; count: number; pct: number }

interface Props {
  items: Item[]
  palette: string[]
  total: number
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) => {
  if (pct < 5) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {pct}%
    </text>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.82rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{d.name}</div>
        <div style={{ color: '#6b7280' }}>{d.count} demo plot · {d.pct}%</div>
      </div>
    )
  }
  return null
}

export default function CommodityChartInner({ items, palette, total }: Props) {
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
        <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#1e293b' }}>{total}</div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo Plot</div>
      </div>
    </div>
  )
}
