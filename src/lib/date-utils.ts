const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

export function formatDateId(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!y || !m || !d) return dateStr
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`
  } catch {
    return dateStr
  }
}

export function getDateRangeLabel(filterQuery?: string): string {
  if (!filterQuery) return 'Semua Waktu (Kumulatif)'

  const queryString = filterQuery.startsWith('?') ? filterQuery.slice(1) : filterQuery
  const params = new URLSearchParams(queryString)
  const start = params.get('start')
  const end = params.get('end')

  if (start && end) {
    if (start === end) return formatDateId(start)
    return `${formatDateId(start)} — ${formatDateId(end)}`
  }

  if (start) return `Sejak ${formatDateId(start)}`
  if (end) return `Hingga ${formatDateId(end)}`

  return 'Semua Waktu (Kumulatif)'
}
