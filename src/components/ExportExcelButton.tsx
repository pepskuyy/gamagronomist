'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

interface Props {
  type: 'cb' | 'demoplot' | 'kios' | 'gathering' | 'company' | 'spot-demplot'
  search: string
  start: string
  end: string
  label?: string
}

export default function ExportExcelButton({ type, search, start, end, label = '📤 Export Excel' }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('type', type)
      if (search) q.set('search', search)
      if (start) q.set('start', start)
      if (end) q.set('end', end)
      
      const res = await fetch(`/api/reports/export?${q.toString()}`)
      const json = await res.json()
      
      if (!res.ok) throw new Error(json.error || 'Failed to export')
      
      if (!json.data || json.data.length === 0) {
        alert('Tidak ada data pada periode ini.')
        setLoading(false)
        return
      }

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(json.data)
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      XLSX.writeFile(wb, `Laporan_${type}_${new Date().toISOString().slice(0,10)}.xlsx`)
      
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleExport} disabled={loading} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      {loading ? '⏳' : ''} {label}
    </button>
  )
}
