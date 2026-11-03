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

// ── Satuan stok produk ──────────────────────────────────────────────────
// "Gramasi kosong" bisa berarti dua hal: produk memang dihitung per kemasan utuh, atau
// isi per kemasan BELUM diinput admin. Yang kedua membuat PCS terbaca sebagai ml/gr,
// jadi stok masuk untuk produk yang satuannya belum ditentukan ditahan dulu.

export type StockUnitMode = 'GRAMASI' | 'KEMASAN'

export interface ModeProduct extends UnitProduct {
  stockUnitMode?: string | null
}

/** GRAMASI bila isi per kemasan terisi; KEMASAN bila dipilih eksplisit; null = belum ditentukan. */
export function stockUnitMode(p: ModeProduct | null | undefined): StockUnitMode | null {
  if (!p) return null
  if (hasGramasi(p)) return 'GRAMASI'
  return p.stockUnitMode === 'KEMASAN' ? 'KEMASAN' : null
}

/** Nilai kolom stockUnitMode yang disimpan saat produk dibuat/diubah. */
export function resolveStockUnitMode(
  p: UnitProduct,
  chosen: string | null | undefined,
): StockUnitMode | null {
  if (hasGramasi(p)) return 'GRAMASI'
  return chosen === 'KEMASAN' ? 'KEMASAN' : null
}

/**
 * Tebak isi per kemasan dari nama produk, mis. "Ziflo 76 WG 800 gr" → 800 gr,
 * "Biogent 50 SC 1 L" → 1000 ml. Hanya saran untuk admin, tidak pernah disimpan otomatis.
 */
export function suggestGramasiFromName(name: string): { unitGramasi: 'ml' | 'gr'; gramasiPerUnit: number } | null {
  const re = /(\d+(?:[.,]\d+)?)\s*(ml|cc|lt|liter|l|gram|gr|g|kg)(?![a-z])/gi
  let last: RegExpExecArray | null = null
  for (let m = re.exec(name); m; m = re.exec(name)) last = m
  if (!last) return null
  const n = parseFloat(last[1].replace(',', '.'))
  if (!(n > 0)) return null
  const u = last[2].toLowerCase()
  if (u === 'ml' || u === 'cc') return { unitGramasi: 'ml', gramasiPerUnit: n }
  if (u === 'l' || u === 'lt' || u === 'liter') return { unitGramasi: 'ml', gramasiPerUnit: n * 1000 }
  if (u === 'kg') return { unitGramasi: 'gr', gramasiPerUnit: n * 1000 }
  return { unitGramasi: 'gr', gramasiPerUnit: n }
}

/** Validasi pasangan gramasi di master produk. Mengembalikan pesan error atau null. */
export function validateGramasiPair(unitGramasi: string | null | undefined, gramasiPerUnit: number | null | undefined): string | null {
  const hasUnit = !!unitGramasi && unitGramasi.trim() !== ''
  const hasPer = gramasiPerUnit !== null && gramasiPerUnit !== undefined && !Number.isNaN(gramasiPerUnit)
  if (hasUnit !== hasPer) return 'Satuan gramasi dan isi per kemasan harus diisi berpasangan (keduanya atau tidak sama sekali).'
  if (hasPer && (gramasiPerUnit as number) <= 0) return 'Isi per kemasan harus lebih dari 0.'
  return null
}
