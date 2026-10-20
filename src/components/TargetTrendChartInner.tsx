'use client'

import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { TrendData } from '@/app/actions/kpi-trend'

// Dipisah dari TargetTrendChart agar recharts di-load lazy (next/dynamic)
export default function TargetTrendChartInner({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip
          contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          cursor={{ fill: '#f3f4f6' }}
        />
        <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
        <Bar dataKey="target" name="Target" fill="#bae6fd" radius={[4, 4, 0, 0]} maxBarSize={50} />
        <Line type="monotone" dataKey="actual" name="Realisasi (Aktual)" stroke="#0ea5e9" strokeWidth={3}
          dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
