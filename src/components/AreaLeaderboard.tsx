'use client'

import { useState, useEffect } from 'react'

type LeaderboardArea = {
  id: string
  name: string
  score: number
  rank: number
}

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function AreaLeaderboard() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear())
  const [selectedActivity, setSelectedActivity] = useState('all')

  const [data, setData] = useState<LeaderboardArea[]>([])
  const [loading, setLoading] = useState(true)

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({
      month: String(selectedMonth),
      year: String(selectedYear),
      activity: selectedActivity,
      _t: String(Date.now()), // cache buster
    })

    try {
      const res = await fetch(`/api/leaderboard/area?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear, selectedActivity])

  const selectStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.45rem 0.75rem',
    fontSize: '0.875rem', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none'
  }

  return (
    <div className="card" style={{ marginBottom: '2.5rem' }}>
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>🏆 Leaderboard Area</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Peringkat area berdasarkan jumlah aktivitas
          </p>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <select style={selectStyle} value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
            <option value="all">Semua Kegiatan</option>
            <option value="demoPlot">Demo Plot</option>
            <option value="visitKios">Kunjungan Kios</option>
            <option value="gathering">Farmer Gathering</option>
            <option value="company">Kunjungan Perusahaan</option>
            <option value="behavior">Customer Behavior</option>
          </select>
          <select style={selectStyle} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select style={selectStyle} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
      ) : data.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '0.5rem' }}>
          Belum ada aktivitas di periode ini.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.map((area) => {
            let rankColor = '#6b7280' // default gray
            let rankBg = '#f3f4f6'
            let rankIcon = ''
            
            if (area.rank === 1) { rankColor = '#ca8a04'; rankBg = '#fef08a'; rankIcon = '🥇' }
            else if (area.rank === 2) { rankColor = '#4b5563'; rankBg = '#e5e7eb'; rankIcon = '🥈' }
            else if (area.rank === 3) { rankColor = '#b45309'; rankBg = '#ffedd5'; rankIcon = '🥉' }

            return (
              <div key={area.id} style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                boxShadow: area.rank <= 3 ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    background: rankBg, color: rankColor, borderRadius: '50%', fontWeight: 700, fontSize: '0.9rem' 
                  }}>
                    {rankIcon || area.rank}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#111827' }}>
                    {area.name}
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {area.score} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#6b7280' }}>kegiatan</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
