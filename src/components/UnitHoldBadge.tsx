import { stockUnitMode } from '@/lib/stock-units'
import { PauseCircle } from 'lucide-react'

type Props = {
  product: { unit?: string | null; unitGramasi?: string | null; gramasiPerUnit?: number | null; stockUnitMode?: string | null }
}

/** Penanda produk yang stok masuknya ditahan karena isi per kemasan belum diisi admin. */
export default function UnitHoldBadge({ product }: Props) {
  if (stockUnitMode({ ...product, unit: product.unit ?? '' }) !== null) return null
  return (
    <span
      title="Isi per kemasan (ml/gr) belum diisi di Master Produk. Approval/penerimaan stok ditahan sampai admin melengkapinya."
      style={{
        marginLeft: '0.375rem', fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem',
        borderRadius: 'var(--radius-xs)', background: 'var(--warning-bg)', color: 'var(--warning)', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem', verticalAlign: 'middle',
      }}
    >
      <PauseCircle size={14} strokeWidth={1.75} />Menunggu data gramasi
    </span>
  )
}
