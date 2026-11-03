'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationBarProps {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
}

export default function PaginationBar({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  if (totalItems === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginTop: '0.75rem',
        padding: '0.5rem 0.25rem',
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
      }}
    >
      <div>
        Menampilkan <strong className="num" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{startItem}–{endItem}</strong> dari <strong className="num" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{totalItems}</strong> data
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              padding: '0.25rem 0.625rem',
              fontSize: '0.8rem',
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={16} strokeWidth={1.75} className="icon-inline" />
            Prev
          </button>

          <span
            style={{
              fontSize: '0.8rem',
              padding: '0.25rem 0.625rem',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-main)',
            }}
          >
            Hal {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{
              padding: '0.25rem 0.625rem',
              fontSize: '0.8rem',
              opacity: currentPage >= totalPages ? 0.4 : 1,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
            <ChevronRight size={16} strokeWidth={1.75} className="icon-inline" />
          </button>
        </div>
      )}
    </div>
  )
}
