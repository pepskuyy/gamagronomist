'use client'

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
        Menampilkan <strong>{startItem}–{endItem}</strong> dari <strong>{totalItems}</strong> data
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.8rem',
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Prev
          </button>

          <span
            style={{
              fontSize: '0.8rem',
              padding: '0.3rem 0.65rem',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              color: 'var(--text)',
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
              padding: '0.3rem 0.65rem',
              fontSize: '0.8rem',
              opacity: currentPage >= totalPages ? 0.4 : 1,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
