/**
 * Aturan satuan stok (aman dipakai di server maupun client).
 *
 * Ledger menyimpan quantity dalam satuan LEDGER:
 *   - gramasi (ml/gr) bila produk "gramasi aktif" (unitGramasi DAN gramasiPerUnit > 0),
 *   - selain itu satuan kemasan (Product.unit: PCS, Btl, Box, ...).
 * SampleLedger, spvStock, dan qty pengajuan restock AFA ke gudang selalu dalam KEMASAN.
 */

export interface UnitProduct {
  unit: string
  unitGramasi?: string | null
  gramasiPerUnit?: number | null
}

/** Produk dianggap bergramasi hanya bila kedua kolom terisi. */
export function hasGramasi(p: UnitProduct | null | undefined): boolean {
  return !!p && !!p.unitGramasi && !!p.gramasiPerUnit && p.gramasiPerUnit > 0
}

/** Label satuan untuk angka ledger (ml/gr atau kemasan). */
export function ledgerUnit(p: UnitProduct | null | undefined): string {
  if (!p) return ''
  return hasGramasi(p) ? (p.unitGramasi as string) : p.unit
}

/** Kemasan → satuan ledger. */
export function kemasanToLedger(p: UnitProduct | null | undefined, qtyKemasan: number): number {
  return hasGramasi(p) ? qtyKemasan * (p!.gramasiPerUnit as number) : qtyKemasan
}

/** Satuan ledger → kemasan (pecahan). Null bila produk tidak bergramasi. */
export function ledgerToKemasan(p: UnitProduct | null | undefined, qtyLedger: number): number | null {
  return hasGramasi(p) ? qtyLedger / (p!.gramasiPerUnit as number) : null
}

const nf = (max = 2) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: max })

/** "1.500 ml (3 Btl)" untuk produk bergramasi; "12 PCS" untuk produk kemasan. */
export function formatLedgerQty(p: UnitProduct | null | undefined, qtyLedger: number, opts: { showKemasan?: boolean } = {}): string {
  const base = `${nf().format(qtyLedger)} ${ledgerUnit(p)}`.trim()
  if (opts.showKemasan === false) return base
  const kemasan = ledgerToKemasan(p, qtyLedger)
  return kemasan === null ? base : `${base} (${nf().format(kemasan)} ${p!.unit})`
}

/** "3 Btl (1.500 ml)" untuk qty kemasan pada produk bergramasi. */
export function formatKemasanQty(p: UnitProduct | null | undefined, qtyKemasan: number): string {
  const base = `${nf().format(qtyKemasan)} ${p?.unit ?? ''}`.trim()
  return hasGramasi(p) ? `${base} (${nf().format(kemasanToLedger(p, qtyKemasan))} ${p!.unitGramasi})` : base
}

/** Validasi pasangan gramasi di master produk. Mengembalikan pesan error atau null. */
export function validateGramasiPair(unitGramasi: string | null | undefined, gramasiPerUnit: number | null | undefined): string | null {
  const hasUnit = !!unitGramasi && unitGramasi.trim() !== ''
  const hasPer = gramasiPerUnit !== null && gramasiPerUnit !== undefined && !Number.isNaN(gramasiPerUnit)
  if (hasUnit !== hasPer) return 'Satuan gramasi dan isi per kemasan harus diisi berpasangan (keduanya atau tidak sama sekali).'
  if (hasPer && (gramasiPerUnit as number) <= 0) return 'Isi per kemasan harus lebih dari 0.'
  return null
}
