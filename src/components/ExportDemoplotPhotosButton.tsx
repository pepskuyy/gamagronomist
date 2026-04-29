'use client'

import { useState } from 'react'

interface Props {
  search: string
  start: string
  end: string
}

export default function ExportDemoplotPhotosButton({ search, start, end }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (start) q.set('start', start)
      if (end) q.set('end', end)

      const res = await fetch(`/api/reports/export-demoplot-photos?${q.toString()}`)
      if (!res.ok) {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const json = await res.json()
          throw new Error(json.error || `Server error (${res.status})`)
        }
        throw new Error(`Server error (${res.status}) — coba filter tanggal lebih sempit atau cek Vercel logs`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateTag = start && end ? `_${start}_sd_${end}` : ''
      a.href = url
      a.download = `Laporan_demoplot_foto${dateTag}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="btn btn-outline"
      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      title="Export Excel dengan foto dokumentasi ter-embed (max 3 foto per baris)"
    >
      {loading ? '⏳' : '🖼️'} {loading ? 'Memuat foto...' : 'Export + Foto'}
    </button>
  )
}
