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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececee" />
        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b70' }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b70' }} />
        <Tooltip
          contentStyle={{ borderRadius: '0.5rem', border: '1px solid rgba(23,23,23,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '0.8rem' }}
          cursor={{ fill: '#f4f4f5' }}
        />
        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '12px', color: '#525252' }} />
        <Bar dataKey="target" name="Target" fill="#e4e4e7" radius={[4, 4, 0, 0]} maxBarSize={50} />
        <Line type="monotone" dataKey="actual" name="Realisasi (Aktual)" stroke="#16824a" strokeWidth={2}
          dot={{ r: 3, fill: '#16824a', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
