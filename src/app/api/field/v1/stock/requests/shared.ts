import { formatKemasanQty, formatLedgerQty, hasGramasi, ledgerUnit } from '@/lib/stock-units'

/** Pengajuan FO → AFA (bukan restock, bukan catatan demo plot) — sama dengan foStockWhere di dashboard/stock. */
export const FO_REQUEST_WHERE = { commodity: { not: 'AFA_STOCK_IN' }, OR: [{ commodity: '-' }, { farmerId: null }] }

export const requestInclude = {
  fo: { select: { name: true } },
  afa: { select: { name: true } },
  details: { include: { product: { select: { id: true, name: true, unit: true, unitGramasi: true, gramasiPerUnit: true } } } },
} as const

type Detail = {
  id: string; productId: string; qtyRequested: number; qtyApproved: number | null; requestUnit: string | null
  product: { name: string; unit: string; unitGramasi: string | null; gramasiPerUnit: number | null }
}
type Req = {
  id: string; foId: string; afaId: string | null; commodity: string | null; status: string; plan: string | null; problem: string | null
  rejectReason: string | null; warehouseSource: string | null; createdAt: Date
  fo: { name: string }; afa: { name: string } | null; details: Detail[]
}

/** Format satuan qty sama dengan describeRequestDetail di dashboard/demoplot. */
export function serializeRequest(req: Req) {
  const isRestock = req.commodity === 'AFA_STOCK_IN'
  return {
    id: req.id,
    kind: isRestock ? 'WAREHOUSE' : 'FO',
    status: req.status,
    createdAt: req.createdAt,
    notes: req.plan && req.plan !== '-' ? req.plan : null,
    approveNotes: !isRestock && req.status !== 'SUBMITTED' && req.problem && req.problem !== '-' ? req.problem : null,
    rejectReason: req.rejectReason,
    warehouseSource: isRestock ? req.warehouseSource : null,
    foId: req.foId,
    foName: req.fo.name,
    afaName: req.afa?.name ?? null,
    items: req.details.map(d => {
      const p = d.product
      const reqUnit = (d.requestUnit || '').trim().toLowerCase()
      const requestedInKemasan = isRestock || (hasGramasi(p) && !!reqUnit && reqUnit !== (p.unitGramasi || '').toLowerCase())
      return {
        id: d.id,
        productId: d.productId,
        name: p.name,
        qtyRequested: d.qtyRequested,
        // Satuan angka qtyRequested (input approval AFA memakai satuan ini, lihat approve.ts)
        requestUnit: requestedInKemasan ? p.unit : ledgerUnit(p),
        requested: requestedInKemasan ? formatKemasanQty(p, d.qtyRequested) : formatLedgerQty(p, d.qtyRequested),
        approved: d.qtyApproved == null ? null : isRestock ? formatKemasanQty(p, d.qtyApproved) : formatLedgerQty(p, d.qtyApproved),
      }
    }),
  }
}
