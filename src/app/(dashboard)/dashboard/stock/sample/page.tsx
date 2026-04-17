'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { addSampleStock } from '@/app/actions/sample-stock'

type Balance  = { productId: string; productName: string; unit: string; balance: number }
type LedgerRow = {
  id: string; transactionType: string; quantity: number; notes: string | null
  referenceId: string | null; createdAt: string; stockBefore: number; stockAfter: number
  product: { name: string; unit: string; unitGramasi?: string | null }
}
type Product = { id: string; name: string; unit: string; unitGramasi?: string | null; gramasiPerUnit?: number | null }

// ── Searchable product combobox ───────────────────────────────────────────────
function ProductCombobox({
  products, value, onChange, placeholder = 'Cari nama produk...',
}: {
  products: Product[]; value: string; onChange: (id: string, product: Product | null) => void; placeholder?: string
}) {
  const [query, setQuery]         = useState('')
  const [open, setOpen]           = useState(false)
  const [highlighted, setHL]      = useState(-1)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const selected = products.find(p => p.id === value)

  const filtered = query.length === 0
    ? products
    : products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

  function selectItem(p: Product) {
    onChange(p.id, p)
    setQuery('')
    setOpen(false)
    setHL(-1)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
    setHL(-1)
    if (e.target.value === '') { onChange('', null) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { setHL(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHL(h => Math.max(h - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter' && highlighted >= 0) { selectItem(filtered[highlighted]); e.preventDefault() }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  const displayVal = open ? query : (selected ? `${selected.name} (${selected.unitGramasi || selected.unit})` : query)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={displayVal}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <div ref={listRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tidak ada produk yang cocok.
            </div>
          ) : filtered.map((p, i) => (
            <div key={p.id}
              onMouseDown={() => selectItem(p)}
              onMouseEnter={() => setHL(i)}
              style={{
                padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.875rem',
                background: i === highlighted ? 'var(--primary-light)' : 'transparent',
                color: i === highlighted ? 'var(--primary)' : 'var(--text-main)',
                fontWeight: p.id === value ? 600 : 400,
                display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center',
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {p.unitGramasi || p.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SampleStockPage() {
  const [tab, setTab]       = useState<'balance' | 'add' | 'history'>('balance')
  const [balances, setBalances] = useState<Balance[]>([])
  const [ledger, setLedger]     = useState<LedgerRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Mode: 'existing' = pilih dari gudang utama | 'new' = buat SKU baru
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  // Existing product form
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedProductObj, setSelectedProductObj] = useState<Product | null>(null)
  const [qty, setQty]     = useState('')
  const [notes, setNotes] = useState('')

  // New product form
  const [newName, setNewName]       = useState('')
  const [newCode, setNewCode]       = useState('')
  const [newUnit, setNewUnit]       = useState('PCS')
  const [newUnitGramasi, setNewUnitGramasi] = useState('')
  const [newGramasiPerUnit, setNewGramasiPerUnit] = useState('')
  const [newQty, setNewQty]         = useState('')
  const [newNotes, setNewNotes]     = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [balRes, ledRes, pRes] = await Promise.all([
      fetch('/api/sample-stock?view=balance'),
      fetch('/api/sample-stock?view=ledger'),
      fetch('/api/master/products'),
    ])
    if (balRes.ok) setBalances(await balRes.json())
    if (ledRes.ok) setLedger(await ledRes.json())
    if (pRes.ok)   setProducts(await pRes.json())
    setLoading(false)
  }

  function resetForms() {
    setSelectedProduct(''); setSelectedProductObj(null)
    setQty(''); setNotes('')
    setNewName(''); setNewCode(''); setNewUnit('PCS')
    setNewUnitGramasi(''); setNewGramasiPerUnit(''); setNewQty(''); setNewNotes('')
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await addSampleStock(fd)
      if (res?.error) setError(res.error)
      else { setSuccess('Stok berhasil ditambahkan!'); resetForms(); fetchAll() }
    })
  }

  const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
  const thStyle: React.CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }

  const UNITS = ['PCS', 'Btl', 'Bks', 'Box', 'Sak', 'gl', 'Pack', 'Rol', 'Kg', 'Lt']

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)' }}>
        {([['balance', '📦 Saldo Stok'], ['add', '➕ Tambah Stok Masuk'], ['history', '📋 Riwayat']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.6rem 1.2rem', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === key ? 700 : 400,
            color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
            fontSize: '0.875rem', marginBottom: '-2px', transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── SALDO ── */}
      {tab === 'balance' && (
        <div className="table-card">
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</p>
          ) : balances.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
              <p>Belum ada stok di Gudang Sampel.</p>
              <button onClick={() => setTab('add')} className="btn btn-primary" style={{ marginTop: '1rem' }}>+ Tambah Stok Masuk</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Produk', 'Saldo Stok', 'Satuan'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {balances.map(b => (
                  <tr key={b.productId}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{b.productName}</td>
                    <td style={tdStyle}>
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

      {/* ── TAMBAH STOK ── */}
      {tab === 'add' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>➕ Input Stok Masuk Gudang Sampel</h3>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => { setMode('existing'); resetForms() }}
              style={{
                flex: 1, padding: '0.55rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                background: mode === 'existing' ? 'var(--primary)' : 'transparent',
                color: mode === 'existing' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              📦 Produk dari Gudang Utama
            </button>
            <button
              type="button"
              onClick={() => { setMode('new'); resetForms() }}
              style={{
                flex: 1, padding: '0.55rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                background: mode === 'new' ? 'var(--primary)' : 'transparent',
                color: mode === 'new' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              ✨ Buat SKU Baru
            </button>
          </div>

          {error   && <div className="alert alert-danger"   style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

          {/* ── Form: Produk Existing ── */}
          {mode === 'existing' && (
            <form onSubmit={handleAdd}>
              <input type="hidden" name="mode" value="existing" />

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Produk <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="hidden" name="productId" value={selectedProduct} />
                <ProductCombobox
                  products={products}
                  value={selectedProduct}
                  onChange={(id, p) => { setSelectedProduct(id); setSelectedProductObj(p) }}
                  placeholder="Cari nama produk..."
                />
                {selectedProduct === '' && <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ketik minimal 1 karakter untuk mencari</small>}
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Jumlah <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="number" min="1" step="1" name="quantity" className="form-control"
                    placeholder="0" value={qty} onChange={e => setQty(e.target.value)} required style={{ flex: 1 }} />
                  {selectedProductObj && (
                    <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {selectedProductObj.unitGramasi || selectedProductObj.unit}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Catatan</label>
                <input type="text" name="notes" className="form-control"
                  placeholder="Sumber stok, batch, dll."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <button type="submit" disabled={isPending || !selectedProduct} className="btn btn-primary" style={{ width: '100%' }}>
                {isPending ? 'Menyimpan...' : '✅ Simpan Stok Masuk'}
              </button>
            </form>
          )}

          {/* ── Form: Produk Baru (SKU baru) ── */}
          {mode === 'new' && (
            <form onSubmit={handleAdd}>
              <input type="hidden" name="mode" value="new" />
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ✨ SKU baru akan otomatis terdaftar di database produk dan langsung masuk ke Gudang Sampel.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nama Produk <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" name="newName" className="form-control"
                    placeholder="Contoh: Furadan Gold 60kg" value={newName} onChange={e => setNewName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Kode / SKU</label>
                  <input type="text" name="newCode" className="form-control"
                    placeholder="Opsional" value={newCode} onChange={e => setNewCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Satuan Kemasan <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select name="newUnit" className="form-control" value={newUnit} onChange={e => setNewUnit(e.target.value)} required>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Satuan Isi (opsional)</label>
                  <input type="text" name="newUnitGramasi" className="form-control"
                    placeholder="ml / gr / L" value={newUnitGramasi} onChange={e => setNewUnitGramasi(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Isi per Kemasan</label>
                  <input type="number" name="newGramasiPerUnit" className="form-control"
                    placeholder="Contoh: 500" min="0" step="any"
                    value={newGramasiPerUnit} onChange={e => setNewGramasiPerUnit(e.target.value)} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Jumlah Stok Masuk <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="number" min="1" step="1" name="quantity" className="form-control"
                      placeholder="0" value={newQty} onChange={e => setNewQty(e.target.value)} required style={{ flex: 1 }} />
                    {(newUnitGramasi || newUnit) && (
                      <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {newUnitGramasi || newUnit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <input type="text" name="notes" className="form-control"
                    placeholder="Sumber stok, batch, dll." value={newNotes} onChange={e => setNewNotes(e.target.value)} />
                </div>
              </div>

              <button type="submit" disabled={isPending || !newName.trim()} className="btn btn-primary" style={{ width: '100%', background: '#7c3aed', borderColor: '#7c3aed' }}>
                {isPending ? 'Menyimpan...' : '✨ Buat SKU & Tambah Stok'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── RIWAYAT ── */}
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
                  const unit  = row.product.unitGramasi || row.product.unit
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
                          color: isOut ? '#991b1b' : '#166534', whiteSpace: 'nowrap',
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
