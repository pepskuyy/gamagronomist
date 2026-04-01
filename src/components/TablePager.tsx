'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type TablePagerProps = {
  prefix: 'u' | 'a' | 'f'
  currentPage: number
  hasMore: boolean
}

export default function TablePager({ prefix, currentPage, hasMore }: TablePagerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const paramName = `p${prefix}`

  function handleNavigate(page: number) {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set(paramName, String(page))
    router.push(`?${newParams.toString()}`)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 0' }}>
      <button 
        className="btn btn-outline" 
        onClick={() => handleNavigate(currentPage - 1)}
        disabled={currentPage <= 1}
        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: currentPage <= 1 ? 0.4 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
      >
        ← Prev
      </button>

      <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
        Hal {currentPage}
      </span>

      <button 
        className="btn btn-outline" 
        onClick={() => handleNavigate(currentPage + 1)}
        disabled={!hasMore}
        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: !hasMore ? 0.4 : 1, cursor: !hasMore ? 'not-allowed' : 'pointer' }}
      >
        Next →
      </button>
    </div>
  )
}
