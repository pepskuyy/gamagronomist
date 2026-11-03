'use client'

import { useState, useTransition } from 'react'
import { adjustStockBatch, transferStockBetweenUsers } from '@/app/actions/stock-admin'
import SearchableSelect from '@/components/SearchableSelect'
import { Wrench, Repeat, X, Plus } from 'lucide-react'

type StockAdjustmentModalProps = {
  isOpen: boolean
  onClose: () => void
  user: { id: string, name: string, role: string, initialProductId?: string }
  products: { id: string, name: string, unit: string, unitGramasi?: string | null }[]
  /** Saldo user saat ini per produk (satuan ledger) */
  balances?: { productId: string, quantity: number }[]
  /** Akun tujuan untuk mode "Pindah ke akun lain" */
  transferTargets?: { id: string, name: string, role: string }[]
  onSuccess: () => void
}

type AdjustmentRow = {
  id: string
  productId: string
  type: 'plus' | 'minus'
  quantity: string
}

function newRow(): AdjustmentRow {
  return { id: Math.random().toString(36).substring(2, 9), productId: '', type: 'plus', quantity: '' }
}

export default function StockAdjustmentModal({ isOpen, onClose, user, products, balances = [], transferTargets = [], onSuccess }: StockAdjustmentModalProps) {
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AdjustmentRow[]>(() => [
    { id: Math.random().toString(36).substring(2, 9), productId: user.initialProductId || '', type: 'plus', quantity: '' }
  ])
  const [notes, setNotes] = useState('')
  // 'adjust' = koreksi saldo akun ini; 'transfer' = pindahkan stok ke akun lain (dua sisi tercatat sekaligus)
  const [mode, setMode] = useState<'adjust' | 'transfer'>('adjust')
  const [toUserId, setToUserId] = useState('')

  if (!isOpen) return null

  const balanceMap = new Map(balances.map(b => [b.productId, b.quantity]))
  const unitOf = (productId: string) => { const p = products.find(x => x.id === productId); return p ? (p.unitGramasi || p.unit) : '' }
  const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

  function updateRow(id: string, field: keyof AdjustmentRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validRows = rows.filter(r => r.productId && r.quantity && parseFloat(r.quantity) > 0)
    if (validRows.length === 0) {
      setError('Minimal 1 produk harus diisi dengan jumlah > 0.')
      return
    }
    if (!notes.trim()) {
      setError('Keterangan wajib diisi.')
      return
    }

    // Check for duplicate products
    const productIds = validRows.map(r => r.productId)
    if (new Set(productIds).size !== productIds.length) {
      setError('Tidak boleh ada produk yang sama dalam satu penyesuaian.')
      return
    }

    // Pengurangan / pemindahan tidak boleh melebihi saldo (server juga mengecek ulang)
    const over = validRows.find(r => (mode === 'transfer' || r.type === 'minus') && parseFloat(r.quantity) > (balanceMap.get(r.productId) ?? 0) + 1e-9)
    if (over) {
      const p = products.find(x => x.id === over.productId)
      setError(`${p?.name ?? 'Produk'}: jumlah melebihi saldo (${fmtQty(Math.max(0, balanceMap.get(over.productId) ?? 0))} ${unitOf(over.productId)}). Periksa apakah SKU yang dipilih sudah benar.`)
      return
    }
    if (mode === 'transfer' && !toUserId) {
      setError('Pilih akun tujuan.')
      return
    }

    const items = validRows.map(r => ({
      productId: r.productId,
      type: r.type as 'plus' | 'minus',
      quantity: parseFloat(r.quantity),
    }))

    start(async () => {
      const res = mode === 'transfer'
        ? await transferStockBetweenUsers({ fromUserId: user.id, toUserId, items: items.map(i => ({ productId: i.productId, quantity: i.quantity })), notes: notes.trim() })
        : await adjustStockBatch({ userId: user.id, items, notes: notes.trim() })
      if (res?.error) {
        setError(res.error)
      } else {
        setRows([newRow()])
        setNotes('')
        setToUserId('')
        onSuccess()
      }
    })
  }

  // Products already used in other rows
  const usedProductIds = new Set(rows.map(r => r.productId).filter(Boolean))

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={18} strokeWidth={1.75} />Sesuaikan Stok
          </h3>
          <button className="close-btn" onClick={onClose} aria-label="Tutup"><X size={18} strokeWidth={1.75} /></button>
        </div>
        
        <div className="modal-body">
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target User:</div>
            <div style={{ fontWeight: 600 }}>{user.name} <span style={{ fontSize: '0.75rem', fontWeight: 500, background: 'var(--surface-3)', color: 'var(--text-secondary)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-xs)' }}>{user.role}</span></div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {([['adjust', 'Koreksi saldo'], ['transfer', 'Pindah ke akun lain']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setError(null) }}
                className={mode === key ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >{key === 'adjust' ? <Wrench size={16} strokeWidth={1.75} /> : <Repeat size={16} strokeWidth={1.75} />}{label}</button>
            ))}
          </div>

          {mode === 'transfer' && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Akun tujuan</label>
              <SearchableSelect
                options={transferTargets.filter(t => t.id !== user.id).map(t => ({ value: t.id, label: `${t.name} (${t.role})` }))}
                value={toUserId}
                onChange={setToUserId}
                placeholder="-- Cari akun tujuan --"
                required
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Stok berkurang dari {user.name} dan bertambah di akun tujuan dengan SKU dan jumlah yang sama, tercatat sekaligus.
              </p>
            </div>
          )}

          {error && <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Product rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rows.map((row, idx) => (
                <div key={row.id} style={{
                  padding: '0.75rem',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                      Produk #{idx + 1}
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      ><X size={14} strokeWidth={1.75} />Hapus</button>
                    )}
                  </div>

                  <div style={{ marginBottom: '0.5rem' }}>
                    <SearchableSelect
                      options={products
                        .filter(p => !usedProductIds.has(p.id) || p.id === row.productId)
                        .filter(p => mode !== 'transfer' || (balanceMap.get(p.id) ?? 0) > 0)
                        .map(p => {
                          const bal = balanceMap.get(p.id)
                          return { value: p.id, label: `${p.name} (${p.unitGramasi || p.unit})${bal !== undefined ? ` — saldo ${fmtQty(bal)}` : ''}` }
                        })}
                      value={row.productId}
                      onChange={val => updateRow(row.id, 'productId', val)}
                      placeholder="-- Cari produk --"
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {mode === 'adjust' && <div style={{ flex: 1 }}>
                      <select
                        className="form-control"
                        value={row.type}
                        onChange={e => updateRow(row.id, 'type', e.target.value)}
                        style={{ fontSize: '0.875rem' }}
                      >
                        <option value="plus">Tambah (+)</option>
                        <option value="minus">Kurangi (-)</option>
                      </select>
                    </div>}
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="form-control"
                        value={row.quantity}
                        onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                        placeholder={`Jumlah${(() => { const p = products.find(x => x.id === row.productId); return p ? ` (${p.unitGramasi || p.unit})` : '' })()}`}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                  {row.productId && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                      Saldo saat ini: <strong className="num" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmtQty(balanceMap.get(row.productId) ?? 0)}</strong><span className="unit">{unitOf(row.productId)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add product button */}
            <button
              type="button"
              onClick={() => setRows(prev => [...prev, newRow()])}
              style={{
                padding: '0.625rem', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--primary)', fontWeight: 500, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              <Plus size={16} strokeWidth={1.75} />Tambah Produk Lain
            </button>

            {/* Notes */}
            <div>
              <label className="form-label">Keterangan (Harus diisi)</label>
              <textarea
                rows={2}
                className="form-control"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                required
                placeholder="Jelaskan alasan penyesuaian stok ini..."
                style={{ fontSize: '0.875rem' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Berlaku untuk semua produk di atas. Notifikasi akan dikirim otomatis.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isPending}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'Memproses...' : `${mode === 'transfer' ? 'Pindahkan' : 'Simpan'} (${rows.filter(r => r.productId && r.quantity).length} produk)`}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .modal-content {
          background: var(--surface);
          width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          animation: slideUp var(--dur-menu) var(--ease);
        }
        .modal-header {
          padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
          position: sticky; top: 0; background: var(--surface); z-index: 1;
        }
        .modal-body { padding: 1.5rem; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); display: inline-flex; padding: 0.25rem; border-radius: var(--radius-xs); }
        .close-btn:hover { color: var(--text-main); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
