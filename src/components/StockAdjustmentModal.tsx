'use client'

import { useState, useTransition } from 'react'
import { adjustStockBatch, transferStockBetweenUsers } from '@/app/actions/stock-admin'
import SearchableSelect from '@/components/SearchableSelect'

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
            🛠️ Sesuaikan Stok
          </h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target User:</div>
            <div style={{ fontWeight: 600 }}>{user.name} <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{user.role}</span></div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {([['adjust', '🛠️ Koreksi saldo'], ['transfer', '🔁 Pindah ke akun lain']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setError(null) }}
                className={mode === key ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem' }}
              >{label}</button>
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

          {error && <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Product rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rows.map((row, idx) => (
                <div key={row.id} style={{
                  padding: '0.85rem',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Produk #{idx + 1}
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >✕ Hapus</button>
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
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="plus">➕ Tambah (+)</option>
                        <option value="minus">➖ Kurangi (-)</option>
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
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                  {row.productId && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      Saldo saat ini: <strong>{fmtQty(balanceMap.get(row.productId) ?? 0)} {unitOf(row.productId)}</strong>
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
                padding: '0.6rem', borderRadius: 'var(--radius-sm)',
                border: '2px dashed var(--border)', background: 'transparent',
                color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              + Tambah Produk Lain
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
                style={{ fontSize: '0.85rem' }}
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
          background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .modal-content {
          background: var(--surface);
          width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto;
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
          animation: slideUp 0.3s ease-out;
        }
        .modal-header {
          padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
          position: sticky; top: 0; background: var(--surface); z-index: 1;
        }
        .modal-body { padding: 1.5rem; }
        .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted); }
        .close-btn:hover { color: var(--text-main); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
