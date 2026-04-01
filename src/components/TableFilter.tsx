'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type TableFilterProps = {
  prefix: 'u' | 'a' | 'f' // u=User, a=Afa, f=Fo
  showDateRange?: boolean
}

export default function TableFilter({ prefix, showDateRange }: TableFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const qParam = `q${prefix}`
  const startParam = `start_${prefix}`
  const endParam = `end_${prefix}`

  const currentQ = searchParams.get(qParam) || ''
  const currentStart = searchParams.get(startParam) || ''
  const currentEnd = searchParams.get(endParam) || ''

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = fd.get('q') as string
    const start = fd.get('start') as string
    const end = fd.get('end') as string

    const newParams = new URLSearchParams(searchParams.toString())
    
    if (q) newParams.set(qParam, q)
    else newParams.delete(qParam)

    if (start) newParams.set(startParam, start)
    else newParams.delete(startParam)

    if (end) newParams.set(endParam, end)
    else newParams.delete(endParam)

    // Reset pagination to 1 when filtering
    newParams.set(`p${prefix}`, '1')

    router.push(`?${newParams.toString()}`)
  }

  function handleReset() {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete(qParam)
    newParams.delete(startParam)
    newParams.delete(endParam)
    newParams.set(`p${prefix}`, '1')
    router.push(`?${newParams.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', background: 'var(--surface)', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <input 
        type="text" 
        name="q" 
        defaultValue={currentQ} 
        placeholder="Cari nama..." 
        style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', background: 'var(--surface-2)' }} 
      />
      {showDateRange && (
        <>
          <input 
            type="date" 
            name="start" 
            defaultValue={currentStart} 
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', background: 'var(--surface-2)' }} 
            title="Dari Tanggal"
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
          <input 
            type="date" 
            name="end" 
            defaultValue={currentEnd} 
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', background: 'var(--surface-2)' }} 
            title="Sampai Tanggal"
          />
        </>
      )}
      <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Cari</button>
      {(currentQ || currentStart || currentEnd) && (
        <button type="button" onClick={handleReset} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Clear</button>
      )}
    </form>
  )
}
