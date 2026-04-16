'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { addSampleStock } from '@/app/actions/sample-stock'

type Balance = { productId: string; productName: string; unit: string; balance: number }
type LedgerRow = {
  id: string
  transactionType: string
  quantity: number
  notes: string | null
  referenceId: string | null
  createdAt: string
  stockBefore: number
  stockAfter: number
  product: { name: string; unit: string; unitGramasi?: string | null }
}
type Product = { id: string; name: string; unit: string; unitGramasi?: string | null }

export default function SampleStockPage() {
  const [tab, setTab] = useState<'balance' | 'add' | 'history'>('balance')
  const [balances, setBalances] = useState<Balance[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [balRes, ledRes, pRes] = await Promise.all([
      fetch('/api/sample-stock?view=balance'),
      fetch('/api/sample-stock?view=ledger'),
      fetch('/api/master/products'),
    ])
    if (balRes.ok) setBalances(await balRes.json())
    if (ledRes.ok) setLedger(await ledRes.json())
    if (pRes.ok) setProducts(await pRes.json())
    setLoading(false)
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await addSampleStock(fd)
      if (res?.error) { setError(res.error) }
      else { setSuccess('Stok berhasil ditambahkan.'); setSelectedProduct(''); setQty(''); setNotes(''); fetchAll() }
    })
  }

  const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
  const thStyle: React.CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }

  return (
    <div>
      {/* Header */}
      <div className="back-header" style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>🧪 Gudang Sampel</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Stok sampel SPV — terpisah dari Gudang Utama (Accurate)
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {([['balance', '📦 Saldo Stok'], ['add', '➕ Tambah Stok Masuk'], ['history', '📋 Riwayat']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '0.6rem 1.2rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
              fontSize: '0.875rem', marginBottom: '-2px', transition: 'all 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── TAB: SALDO ── */}
      {tab === 'balance' && (
        <div className="table-card">
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</p>
          ) : balances.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
              <p>Belum ada stok di Gudang Sampel.</p>
              <button onClick={() => setTab('add')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                + Tambah Stok Masuk
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Produk', 'Saldo Stok', 'Satuan'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {balances.map(b => (
                  <tr key={b.productId}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{b.productName}</td>
                    <td style={{ ...tdStyle }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: b.balance <= 0 ? '#dc2626' : '#16a34a' }}>
                        {b.balance}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{b.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: TAMBAH STOK ── */}
      {tab === 'add' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h3 style={{ marginBottom: '1.25rem' }}>➕ Input Stok Masuk Gudang Sampel</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}
          <form onSubmit={handleAdd}>
            <input type="hidden" name="warehouseSource" value="SAMPLE" />
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Produk <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                name="productId"
                className="form-control"
                required
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
              >
                <option value="">-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unitGramasi || p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Jumlah <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number" min="1" step="1"
                  name="quantity" className="form-control"
                  placeholder="0"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  required
                  style={{ flex: 1 }}
                />
                {selectedProduct && (
                  <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {products.find(p => p.id === selectedProduct)?.unitGramasi || products.find(p => p.id === selectedProduct)?.unit || ''}
                  </span>
                )}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Catatan</label>
              <input
                type="text" name="notes" className="form-control"
                placeholder="Sumber stok, batch, dll."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ width: '100%' }}>
              {isPending ? 'Menyimpan...' : '✅ Simpan Stok Masuk'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB: RIWAYAT ── */}
      {tab === 'history' && (
        <div className="table-card">
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</p>
          ) : ledger.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada riwayat transaksi sampel.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Tanggal', 'Produk', 'Jenis', 'Stok Awal', 'Jumlah', 'Stok Akhir', 'Catatan'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map(row => {
                  const isOut = row.quantity < 0
                  const unit = row.product.unitGramasi || row.product.unit
                  return (
                    <tr key={row.id}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.createdAt))}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{row.product.name}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                          background: isOut ? '#fee2e2' : '#dcfce7',
                          color: isOut ? '#991b1b' : '#166534',
                          whiteSpace: 'nowrap',
                        }}>
                          {isOut ? '📤 Keluar ke AFA' : '📥 Stok Masuk'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {row.stockBefore} {unit}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: isOut ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {isOut ? '' : '+'}{row.quantity} {unit}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: isOut ? '#dc2626' : '#16a34a', textAlign: 'right' }}>
                        {row.stockAfter} {unit}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.notes || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
