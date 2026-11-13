'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Plus, Send, Trash2, X } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import {
  submitStockTransfer, approveStockTransfer, rejectStockTransfer, cancelStockTransfer, receiveStockTransfer,
} from '@/app/actions/stock-transfer'
import { ledgerUnit } from '@/lib/stock-units'

type UnitProduct = { name: string; unit: string; unitGramasi?: string | null; gramasiPerUnit?: number | null }
export type TransferRow = {
  id: string
  status: string
  notes: string | null
  rejectReason: string | null
  createdAt: string
  fromUser: { id: string; name: string }
  toUser: { id: string; name: string }
  items: { id: string; qtyRequested: number; qtyApproved: number | null; product: UnitProduct }[]
}

type Props = {
  role: string
  meId: string
  transfers: TransferRow[]
  targets: { id: string; name: string }[]
  balances: { productId: string; quantity: number; product: UnitProduct }[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Menunggu SPV', cls: 'badge-warning' },
  APPROVED:  { label: 'Menunggu diterima', cls: 'badge-neutral' },
  RECEIVED:  { label: 'Diterima', cls: 'badge-success' },
  REJECTED:  { label: 'Ditolak', cls: 'badge-danger' },
  CANCELLED: { label: 'Dibatalkan', cls: 'badge-neutral' },
}

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem',
}

export default function StockTransferPanel({ role, meId, transfers, targets, balances }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const isApprover = role === 'SPV' || role === 'ADMIN'
  const isSender = role === 'AFA' || role === 'PLANTATION'

  // Form pengajuan (AFA)
  const [formOpen, setFormOpen] = useState(false)
  const [toUserId, setToUserId] = useState('')
  const [rows, setRows] = useState<{ productId: string; qty: string }[]>([{ productId: '', qty: '' }])
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Approval (SPV/ADMIN)
  const [approveId, setApproveId] = useState<string | null>(null)
  const [approveQty, setApproveQty] = useState<Record<string, string>>({})

  const balanceOf = (productId: string) => balances.find(b => b.productId === productId)

  function run(action: () => Promise<{ error: string } | { success: boolean }>, after?: () => void) {
    start(async () => {
      const res = await action()
      if ('error' in res) alert(res.error)
      else { after?.(); router.refresh() }
    })
  }

  function submit() {
    setFormError(null)
    const items = rows.filter(r => r.productId && Number(r.qty) > 0).map(r => ({ productId: r.productId, quantity: Number(r.qty) }))
    if (!toUserId) return setFormError('Pilih AFA penerima.')
    if (items.length === 0) return setFormError('Isi minimal 1 produk dengan jumlah > 0.')
    const over = items.find(i => i.quantity > (balanceOf(i.productId)?.quantity ?? 0) + 1e-9)
    if (over) return setFormError(`${balanceOf(over.productId)?.product.name}: jumlah melebihi saldo.`)
    start(async () => {
      const res = await submitStockTransfer({ toUserId, items, notes })
      if (res?.error) setFormError(res.error)
      else {
        setFormOpen(false); setToUserId(''); setRows([{ productId: '', qty: '' }]); setNotes('')
        router.refresh()
      }
    })
  }

  const approving = transfers.find(t => t.id === approveId)

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Transfer Stok Antar AFA</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}>
            Diajukan pengirim, disetujui SPV, stok berpindah saat penerima konfirmasi terima.
          </p>
        </div>
        {isSender && (
          <button className="btn btn-primary" onClick={() => setFormOpen(true)} disabled={balances.length === 0}>
            <Send size={16} strokeWidth={1.75} /> Ajukan Transfer
          </button>
        )}
      </div>

      {transfers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}><p>Belum ada transfer stok.</p></div>
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Dari → Ke</th><th>Produk</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
              </thead>
              <tbody>
                {transfers.map(t => {
                  const st = STATUS[t.status] ?? { label: t.status, cls: 'badge-neutral' }
                  return (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}>
                          {t.fromUser.name}<ArrowRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />{t.toUser.name}
                        </span>
                        {t.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.notes}</div>}
                      </td>
                      <td>
                        {t.items.map(it => {
                          const unit = ledgerUnit(it.product)
                          const revised = it.qtyApproved != null && it.qtyApproved !== it.qtyRequested
                          return (
                            <div key={it.id} style={{ fontSize: '0.82rem' }}>
                              {it.product.name}:{' '}
                              {revised && <span className="num" style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '0.25rem' }}>{fmt(it.qtyRequested)}</span>}
                              <span className="num" style={{ fontWeight: 500 }}>{fmt(it.qtyApproved ?? it.qtyRequested)}</span><span className="unit">{unit}</span>
                            </div>
                          )
                        })}
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        {t.rejectReason && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>{t.rejectReason}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {isApprover && t.status === 'SUBMITTED' && (
                            <button className="btn btn-primary" disabled={isPending} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => { setApproveId(t.id); setApproveQty(Object.fromEntries(t.items.map(it => [it.id, String(it.qtyRequested)]))) }}>
                              <Check size={14} strokeWidth={1.75} /> Setujui
                            </button>
                          )}
                          {isApprover && (t.status === 'SUBMITTED' || t.status === 'APPROVED') && (
                            <button className="btn btn-outline" disabled={isPending} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)' }}
                              onClick={() => {
                                const reason = prompt('Alasan penolakan:')
                                if (reason?.trim()) run(() => rejectStockTransfer(t.id, reason))
                              }}>
                              <X size={14} strokeWidth={1.75} /> Tolak
                            </button>
                          )}
                          {t.status === 'SUBMITTED' && t.fromUser.id === meId && (
                            <button className="btn btn-outline" disabled={isPending} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => { if (confirm('Batalkan pengajuan transfer ini?')) run(() => cancelStockTransfer(t.id)) }}>
                              Batalkan
                            </button>
                          )}
                          {t.status === 'APPROVED' && t.toUser.id === meId && (
                            <button className="btn btn-primary" disabled={isPending} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => { if (confirm('Konfirmasi barang sudah diterima? Stok akan dipindahkan ke akun Anda.')) run(() => receiveStockTransfer(t.id)) }}>
                              <Check size={14} strokeWidth={1.75} /> Konfirmasi Terima
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal pengajuan (AFA pengirim) */}
      {formOpen && (
        <div style={overlay} onClick={() => setFormOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Ajukan Transfer Stok</h3>
            <div className="form-group">
              <label className="form-label">AFA penerima</label>
              <SearchableSelect options={targets.map(t => ({ value: t.id, label: t.name }))} value={toUserId} onChange={setToUserId} placeholder="-- Cari AFA penerima --" />
            </div>
            {rows.map((r, idx) => {
              const bal = balanceOf(r.productId)
              const used = new Set(rows.map(x => x.productId))
              return (
                <div key={idx} style={{ padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect
                        options={balances.filter(b => b.quantity > 0 && (!used.has(b.productId) || b.productId === r.productId))
                          .map(b => ({ value: b.productId, label: `${b.product.name} — saldo ${fmt(b.quantity)} ${ledgerUnit(b.product)}` }))}
                        value={r.productId}
                        onChange={v => setRows(prev => prev.map((x, i) => i === idx ? { ...x, productId: v } : x))}
                        placeholder="-- Pilih produk --"
                      />
                    </div>
                    {rows.length > 1 && (
                      <button type="button" aria-label="Hapus baris" onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', display: 'inline-flex' }}>
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="number" min="0" step="any" className="form-control" style={{ maxWidth: 160 }} placeholder="Jumlah"
                      value={r.qty} onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))} />
                    {bal && <span className="unit">{ledgerUnit(bal.product)}</span>}
                  </div>
                </div>
              )
            })}
            <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => setRows(prev => [...prev, { productId: '', qty: '' }])}>
              <Plus size={16} strokeWidth={1.75} /> Tambah produk
            </button>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Keperluan transfer (opsional)" />
            </div>
            {formError && <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setFormOpen(false)} disabled={isPending}>Batal</button>
              <button className="btn btn-primary" onClick={submit} disabled={isPending}>{isPending ? 'Mengirim...' : 'Ajukan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal persetujuan (SPV/ADMIN): jumlah bisa dikurangi, 0 = item dicoret */}
      {approving && (
        <div style={overlay} onClick={() => setApproveId(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.25rem' }}>Setujui Transfer</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              {approving.fromUser.name} → {approving.toUser.name}. Jumlah boleh dikurangi; isi 0 untuk mencoret item.
            </p>
            {approving.items.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 500 }}>{it.product.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Diajukan <span className="num">{fmt(it.qtyRequested)}</span><span className="unit">{ledgerUnit(it.product)}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="number" min="0" max={it.qtyRequested} step="any" className="form-control" style={{ width: 110, textAlign: 'right' }}
                    value={approveQty[it.id] ?? ''} onChange={e => setApproveQty(prev => ({ ...prev, [it.id]: e.target.value }))} />
                  <span className="unit">{ledgerUnit(it.product)}</span>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setApproveId(null)} disabled={isPending}>Batal</button>
              <button className="btn btn-primary" disabled={isPending}
                onClick={() => run(() => approveStockTransfer(approving.id, Object.fromEntries(Object.entries(approveQty).map(([k, v]) => [k, Number(v)]))), () => setApproveId(null))}>
                <Check size={16} strokeWidth={1.75} /> Setujui
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
