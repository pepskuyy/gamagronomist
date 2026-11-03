'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface User {
  id: string
  name: string
  role: string
}

interface Area {
  id: string
  name: string
}

interface Props {
  subordinates: User[]
  areas: Area[]
}

const selectStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  background: 'var(--surface)',
  cursor: 'pointer',
  outline: 'none',
  minWidth: '150px',
  flex: 1,
}

export default function DashboardChartFilter({ subordinates, areas }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [start, setStart] = useState(searchParams.get('start') || '')
  const [end, setEnd] = useState(searchParams.get('end') || '')
  const [userId, setUserId] = useState(searchParams.get('userId') || '')
  const [areaId, setAreaId] = useState(searchParams.get('areaId') || '')

  useEffect(() => {
    setStart(searchParams.get('start') || '')
    setEnd(searchParams.get('end') || '')
    setUserId(searchParams.get('userId') || '')
    setAreaId(searchParams.get('areaId') || '')
  }, [searchParams])

  const applyFilter = () => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (userId) params.set('userId', userId)
    if (areaId) params.set('areaId', areaId)

    router.push(`/dashboard?${params.toString()}`, { scroll: false })
  }

  const resetFilter = () => {
    setStart('')
    setEnd('')
    setUserId('')
    setAreaId('')
    router.push(`/dashboard`, { scroll: false })
  }

  const hasFilter = start || end || userId || areaId

  return (
    <div className="card" style={{ marginBottom: '2.5rem', background: 'var(--surface-2)', boxShadow: 'none' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={18} strokeWidth={1.75} className="icon-inline" style={{ color: 'var(--text-muted)' }} />Filter Peta & Grafik</h3>
        {hasFilter && (
          <button
            onClick={resetFilter}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
            }}>
            <X size={16} strokeWidth={1.75} className="icon-inline" />
            Reset Filter
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '130px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tanggal Mulai</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={selectStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '130px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tanggal Akhir</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={selectStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Petugas (User)</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} style={selectStyle}>
            <option value="">-- Semua Petugas --</option>
            {subordinates.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Area</label>
          <select value={areaId} onChange={e => setAreaId(e.target.value)} style={selectStyle}>
            <option value="">-- Semua Area --</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <button
            onClick={applyFilter}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', minWidth: '100px'
            }}>
            Terapkan
          </button>
        </div>
      </div>
    </div>
  )
}
