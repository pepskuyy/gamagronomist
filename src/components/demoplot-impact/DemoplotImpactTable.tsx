'use client'

import { useMemo, useState } from 'react'
import { ClipboardList, Download, Info, Star } from 'lucide-react'
import PaginationBar from '@/components/PaginationBar'
import type { MapDemoplotItem } from './DemoplotImpactMapInner'
import { getImpactTier, formatImpactPct, formatKm, HELP_IMPACT_PCT, HELP_SAMPLE_YIELD } from '@/lib/impact-tier'
import { formatDateId } from '@/lib/date-utils'

interface Props {
  demoplots: MapDemoplotItem[]
  loading: boolean
  radiusKm: number
  selectedDemoplotId: string | null
  onSelect: (dp: MapDemoplotItem) => void
  periodLabel: string
}

type SortKey = 'date' | 'pct'
const PAGE_SIZE = 15

function sortRows(rows: MapDemoplotItem[], key: SortKey) {
  const out = [...rows]
  if (key === 'pct') {
    // Menurun; null di paling bawah; seri → toko terdampak terbanyak
    out.sort((a, b) => {
      const pa = a.impact?.impact_pct ?? null
      const pb = b.impact?.impact_pct ?? null
      if (pa === null && pb === null) return 0
      if (pa === null) return 1
      if (pb === null) return -1
      if (pb !== pa) return pb - pa
      return (b.impact?.impacted_store_count ?? 0) - (a.impact?.impacted_store_count ?? 0)
    })
  } else {
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }
  return out
}

/** "Ziflo 76 WG 800 gr: 5,33 Bks (200 gr) per gr sampel" per produk bersampel; "-" bila tidak ada */
function yieldLines(dp: MapDemoplotItem): string[] {
  return (dp.impact?.product_yields ?? []).map(y => `${y.product}: ${y.label}`)
}

function YieldCell({ dp, loading }: { dp: MapDemoplotItem; loading: boolean }) {
  if (loading) return <span style={{ color: 'var(--text-muted)' }}>…</span>
  const lines = yieldLines(dp)
  if (lines.length === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.76rem', color: 'var(--info)', fontWeight: 500 }} className="num">
      {lines.map(l => <span key={l} style={{ overflowWrap: 'anywhere' }}>{l}</span>)}
    </span>
  )
}

function PctCell({ dp, radiusLabel, loading }: { dp: MapDemoplotItem; radiusLabel: string; loading: boolean }) {
  if (loading) return <span style={{ color: 'var(--text-muted)' }}>…</span>
  const imp = dp.impact
  if (!imp || imp.impact_pct === null) return <span style={{ color: 'var(--text-muted)' }}>-</span>
  const tier = getImpactTier(imp.impact_pct)
  const tip = `${imp.impacted_store_count} dari ${imp.store_count} toko di radius ${radiusLabel}` +
    (imp.impact_pct_capped ? ` (batas bawah: analisa dibatasi ${imp.analyzed_store_count} toko terdekat)` : '')
  return (
    <span title={tip} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
      <span className="num" style={{ fontWeight: 600, color: tier.text }}>
        {formatImpactPct(imp.impact_pct, imp.impact_pct_capped)}
      </span>
      <span style={{ width: '48px', height: '4px', background: 'var(--surface-3)', borderRadius: '9999px', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${Math.min(100, imp.impact_pct)}%`, height: '100%', background: tier.bar }} />
      </span>
    </span>
  )
}

export default function DemoplotImpactTable({ demoplots, loading, radiusKm, selectedDemoplotId, onSelect, periodLabel }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const radiusLabel = formatKm(radiusKm)

  const sorted = useMemo(() => sortRows(demoplots, sortKey), [demoplots, sortKey])
  // Data bisa menyusut saat filter/radius berubah: jaga halaman tetap valid
  const currentPage = Math.min(page, Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)))
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx') // lazy-load
      const header = [
        'Tanggal', 'Petani', 'Komoditas', 'Area', 'FO', 'Produk',
        `Jumlah Toko (Radius ${radiusLabel})`, 'Toko Dianalisa', 'Toko Terdampak', '% Toko Terdampak',
        'Terdampak', 'Omset Sebelum (60 hari)', 'Omset Sesudah (60 hari)',
        'Rasio Sampel → Penjualan per Produk (60 hari sesudah)',
      ]
      const rows = sorted.map((dp) => {
        const imp = dp.impact
        const pct = imp?.impact_pct ?? null
        return [
          dp.date, dp.farmerName, dp.commodity, dp.area, dp.foName, dp.products.join(', '),
          imp?.store_count ?? 0, imp?.analyzed_store_count ?? 0, imp?.impacted_store_count ?? 0,
          pct === null ? '-' : imp?.impact_pct_capped ? `≥${pct}` : pct,
          dp.has_impact ? 'Ya' : 'Tidak',
          Math.round(imp?.before_omset ?? 0), Math.round(imp?.after_omset ?? 0),
          yieldLines(dp).join('; ') || '-',
        ]
      })
      const info = [
        ['Analisa Dampak Demplot'],
        [`Radius ${radiusLabel}`],
        [`Periode: ${periodLabel}`],
        ['Window: 60 hari sebelum vs 60 hari sesudah demplot'],
        [],
      ]
      const ws = XLSX.utils.aoa_to_sheet([...info, header, ...rows])
      // Format 1 desimal untuk kolom % (indeks 9) pada baris data numerik
      const firstDataRow = info.length + 1
      for (let r = 0; r < rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r: firstDataRow + r, c: 9 })]
        if (cell && cell.t === 'n') cell.z = '0.0'
      }
      ws['!cols'] = [12, 22, 12, 22, 18, 40, 22, 14, 14, 16, 11, 20, 20, 60].map((wch) => ({ wch }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Dampak Demplot')
      XLSX.writeFile(wb, `dampak_demplot_radius_${String(radiusKm).replace('.', ',')}km_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="impact-table-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
      <style>{`
        .impact-table-cards { display: none; }
        @media (max-width: 640px) {
          .impact-table-desktop { display: none; }
          .impact-table-cards { display: flex; }
        }
        .impact-row { cursor: pointer; }
        .impact-row:hover td { background: var(--surface-2); }
      `}</style>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '1rem 1rem 0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Daftar Demplot & Dampak</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {demoplots.length} demplot • toko dihitung dalam radius {radiusLabel} • window 60 hari sebelum vs sesudah
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey)
              setPage(1)
            }}
            aria-label="Urutan tabel"
            style={{ padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-main)' }}
          >
            <option value="date">Urut: tanggal terbaru</option>
            <option value="pct">Urut: % terdampak</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || demoplots.length === 0}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              fontWeight: 500,
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              cursor: exporting ? 'wait' : 'pointer',
              opacity: loading || demoplots.length === 0 ? 0.6 : 1,
            }}
          >
            {!exporting && <Download size={14} strokeWidth={1.75} />}
            {exporting ? 'Mengekspor…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Desktop / tablet: tabel */}
      <div className="impact-table-desktop table-responsive">
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Petani</th>
              <th>FO</th>
              <th>Produk</th>
              <th style={{ textAlign: 'right' }}>Jumlah Toko (Radius {radiusLabel})</th>
              <th style={{ textAlign: 'right' }}>Toko Terdampak</th>
              <th style={{ textAlign: 'right' }}>
                % Terdampak <span title={HELP_IMPACT_PCT(radiusLabel)} style={{ cursor: 'help', color: 'var(--text-light)' }}><Info size={14} strokeWidth={1.75} className="icon-inline" /></span>
              </th>
              <th style={{ minWidth: '220px' }}>
                Rasio Sampel → Penjualan <span title={HELP_SAMPLE_YIELD(radiusLabel)} style={{ cursor: 'help', color: 'var(--text-light)' }}><Info size={14} strokeWidth={1.75} className="icon-inline" /></span>
              </th>
              <th style={{ textAlign: 'center' }}>Terdampak</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((dp) => (
              <tr
                key={dp.id}
                className="impact-row"
                onClick={() => onSelect(dp)}
                style={dp.id === selectedDemoplotId ? { background: 'var(--primary-light)' } : undefined}
              >
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{formatDateId(dp.date)}</td>
                <td style={{ fontWeight: 500 }}>{dp.farmerName}</td>
                <td style={{ fontSize: '0.82rem' }}>{dp.foName}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '260px' }}>{dp.products.join(', ') || '-'}</td>
                <td className="num" style={{ textAlign: 'right' }}>{loading ? '…' : dp.impact?.store_count ?? '-'}</td>
                <td className="num" style={{ textAlign: 'right' }}>{loading ? '…' : dp.impact?.impacted_store_count ?? '-'}</td>
                <td style={{ textAlign: 'right' }}>
                  <PctCell dp={dp} radiusLabel={radiusLabel} loading={loading} />
                </td>
                <td>
                  <YieldCell dp={dp} loading={loading} />
                </td>
                <td style={{ textAlign: 'center', color: 'var(--warning)' }}>{dp.has_impact ? <Star size={14} strokeWidth={1.75} fill="currentColor" className="icon-inline" aria-label="Terdampak" /> : ''}</td>
              </tr>
            ))}
            {!loading && demoplots.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tidak ada demplot berkoordinat pada periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* HP: kartu, tanpa scroll horizontal */}
      <div className="impact-table-cards" style={{ flexDirection: 'column', gap: '0.5rem', padding: '0 1rem 1rem' }}>
        {paginated.map((dp) => (
          <button
            key={dp.id}
            type="button"
            onClick={() => onSelect(dp)}
            style={{
              textAlign: 'left',
              width: '100%',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: dp.id === selectedDemoplotId ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: dp.id === selectedDemoplotId ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-main)', overflowWrap: 'anywhere' }}>
                  {dp.farmerName} {dp.has_impact ? <Star size={14} strokeWidth={1.75} fill="currentColor" className="icon-inline" style={{ color: 'var(--warning)' }} aria-label="Terdampak" /> : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatDateId(dp.date)} • {dp.foName}
                </div>
              </div>
              <PctCell dp={dp} radiusLabel={radiusLabel} loading={loading} />
            </div>
            <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {loading ? '…' : `${dp.impact?.impacted_store_count ?? 0} dari ${dp.impact?.store_count ?? 0} toko di radius ${radiusLabel}`}
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <YieldCell dp={dp} loading={loading} />
            </div>
          </button>
        ))}
      </div>

      <PaginationBar currentPage={currentPage} totalItems={sorted.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
