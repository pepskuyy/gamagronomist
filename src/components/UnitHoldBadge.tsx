import { stockUnitMode } from '@/lib/stock-units'

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
        marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.45rem',
        borderRadius: '9999px', background: '#fef3c7', color: '#92400e', whiteSpace: 'nowrap',
      }}
    >
      ⏸ Menunggu data gramasi
    </span>
  )
}
