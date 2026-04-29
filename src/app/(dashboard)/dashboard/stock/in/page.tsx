'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'
import SearchableSelect from '@/components/SearchableSelect'

type SpvProduct = {
  id:             string
  name:           string
  unit:           string
  unitGramasi?:   string | null
  gramasiPerUnit?:number | null
  spvStock?:      number | null  // stok SPV dari Accurate (dalam kemasan)
}
type SampleProduct = {
  productId:      string
  productName:    string
  unit:           string
  unitGramasi:    string | null
  gramasiPerUnit: number | null
  balance:        number  // stok sampel SPV (kemasan)
}
type SelectedProduct = {
  productId:      string
  qtyRequested:   number
  name:           string
  unit:           string
  unitGramasi?:   string | null
  gramasiPerUnit?:number | null
  spvStock?:      number | null
}
type CustomProduct = {
  tempId:   string  // local-only identifier
  name:     string
  unit:     string
  qty:      number
  notes:    string  // e.g. deskripsi tambahan
}

/** Format stok SPV: "12 Btl" atau "Belum tersedia" */
function formatSpvStock(stock: number | null | undefined, unit: string) {
  if (stock == null) return null
  return `${stock.toLocaleString('id-ID')} ${unit}`
}

/** Format stok AFA dalam gramasi + konversi kemasan desimal: "1.5 Btl (750ml)" */
function formatAfaStock(gramasi: number, unit: string, unitGramasi?: string | null, gramasiPerUnit?: number | null) {
  if (unitGramasi && gramasiPerUnit && gramasiPerUnit > 0) {
    const kemasanFloat = gramasi / gramasiPerUnit
    const kemasanLabel = Number.isInteger(kemasanFloat)
      ? kemasanFloat.toString()
      : kemasanFloat.toFixed(2).replace(/\.?0+$/, '')
    return `${kemasanLabel} ${unit} (${gramasi.toLocaleString('id-ID')}${unitGramasi})`
  }
  return `${gramasi.toLocaleString('id-ID')} ${unit}`
}

export default function StockInPage() {
  const router = useRouter()

  const [products, setProducts]         = useState<SpvProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const [sampleProducts, setSampleProducts]     = useState<SampleProduct[]>([])
  const [loadingSample, setLoadingSample]       = useState(true)

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]     = useState('')
  const [currentQty, setCurrentQty]             = useState('')
  const [notes, setNotes]               = useState('')
  const [warehouseSource, setWarehouseSource] = useState<'MAIN' | 'SAMPLE'>('MAIN')
  const [error, setError]               = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

  // Custom (non-SKU) products — only for SAMPLE mode
  const [customProducts, setCustomProducts]         = useState<CustomProduct[]>([])
  const [customName, setCustomName]                 = useState('')
  const [customUnit, setCustomUnit]                 = useState('')
  const [customQty, setCustomQty]                   = useState('')
  const [customNotes, setCustomNotes]               = useState('')

  useEffect(() => {
    // Fetch Accurate (main warehouse) products
    fetch('/api/spv-stock')
      .then(r => r.json())
      .then(data => {
        setProducts(data.products ?? [])
        setLastSyncedAt(data.lastSyncedAt ?? null)
        setLoadingProducts(false)
      })
      .catch(() => setLoadingProducts(false))

    // Fetch sample warehouse products
    fetch('/api/sample-stock-for-afa')
      .then(r => r.json())
      .then(data => {
        setSampleProducts(Array.isArray(data) ? data : [])
        setLoadingSample(false)
      })
      .catch(() => setLoadingSample(false))
  }, [])

  // Clear selected products whenever warehouse source changes to avoid cross-source items
  useEffect(() => {
    setSelectedProducts([])
    setCustomProducts([])
    setCurrentProduct('')
    setCurrentQty('')
    setCustomName('')
    setCustomUnit('')
    setCustomQty('')
    setCustomNotes('')
  }, [warehouseSource])

  // Active product list depends on warehouse source
  const isSample = warehouseSource === 'SAMPLE'
  // For SAMPLE mode, use the same full product list but cross-reference sample balance
  const selectedDetail = products.find(p => p.id === currentProduct)
  // Sample balance for the currently selected product (may be undefined if not yet in sample stock)
  const currentSampleBalance = isSample
    ? sampleProducts.find(p => p.productId === currentProduct)?.balance ?? null
    : null

  function addProduct() {
    const qty = Number(currentQty)
    if (!currentProduct || qty <= 0) return
    if (!Number.isInteger(qty)) {
      alert('Pengajuan ke SPV harus dalam satuan kemasan utuh (bilangan bulat). Tidak bisa eceran.')
      return
    }
    if (selectedProducts.find(p => p.productId === currentProduct)) {
      alert('Produk ini sudah ada dalam daftar.'); return
    }

    const detail = products.find(p => p.id === currentProduct)
    if (!detail) return

    if (isSample) {
      // Sample warehouse: AFA requests any product — no balance restriction.
      // SPV will procure and validate stock at approval time.
      const sampleBalance = sampleProducts.find(p => p.productId === currentProduct)?.balance ?? null
      setSelectedProducts(prev => [...prev, {
        productId:      detail.id,
        qtyRequested:   qty,
        name:           detail.name,
        unit:           detail.unit,
        unitGramasi:    detail.unitGramasi,
        gramasiPerUnit: detail.gramasiPerUnit,
        spvStock:       sampleBalance,  // shows sample balance (can be null = not yet stocked)
      }])
      setCurrentProduct('')
      setCurrentQty('')
      return
    }

    // Main warehouse: pull from Accurate products
    if (detail.spvStock != null && qty > detail.spvStock) {
      alert(`Jumlah melebihi stok SPV! Tersedia: ${detail.spvStock} ${detail.unit}`)
      return
    }

    setSelectedProducts(prev => [...prev, {
      productId:      detail.id,
      qtyRequested:   qty,
      name:           detail.name,
      unit:           detail.unit,
      unitGramasi:    detail.unitGramasi,
      gramasiPerUnit: detail.gramasiPerUnit,
      spvStock:       detail.spvStock,
    }])
    setCurrentProduct('')
    setCurrentQty('')
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id))
  }

  function addCustomProduct() {
    const trimName = customName.trim()
    const trimUnit = customUnit.trim()
    const qty = Number(customQty)
    if (!trimName) { alert('Nama produk tidak boleh kosong.'); return }
    if (!trimUnit) { alert('Satuan tidak boleh kosong.'); return }
    if (!qty || qty <= 0 || !Number.isInteger(qty)) { alert('Masukkan jumlah kemasan yang valid (bilangan bulat).'); return }
    setCustomProducts(prev => [...prev, {
      tempId: `custom-${Date.now()}-${Math.random()}`,
      name:   trimName,
      unit:   trimUnit,
      qty,
      notes:  customNotes.trim(),
    }])
    setCustomName('')
    setCustomUnit('')
    setCustomQty('')
    setCustomNotes('')
  }

  function removeCustomProduct(tempId: string) {
    setCustomProducts(prev => prev.filter(p => p.tempId !== tempId))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const hasSkuProducts    = selectedProducts.length > 0
    const hasCustomProducts = customProducts.length > 0
    if (!hasSkuProducts && !hasCustomProducts) {
      setError('Masukkan minimal satu produk (dari SKU atau produk baru) untuk diajukan.'); return
    }
    const payload = selectedProducts.map(p => ({
      productId: p.productId,
      qtyRequested: p.qtyRequested,
    }))
    // Append custom product requests to notes as structured text
    let finalNotes = notes
    if (hasCustomProducts) {
      const customSection = '\n\n[PERMINTAAN PRODUK DI LUAR SKU]\n' +
        customProducts.map((c, i) =>
          `${i + 1}. ${c.name} — ${c.qty} ${c.unit}${c.notes ? ` (${c.notes})` : ''}`
        ).join('\n')
      finalNotes = (finalNotes.trim() + customSection).trim()
    }
    const formData = new FormData()
    formData.append('notes', finalNotes || '-')
    formData.append('products', JSON.stringify(payload))
    formData.append('warehouseSource', warehouseSource)
    startTransition(async () => {
      const res = await submitAfaStockRequest(formData)
      if (res?.error) setError(res.error)
      else router.push('/dashboard/stock')
    })
  }

  const thStyle: React.CSSProperties = { padding: '0.65rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/stock" style={{ color: 'var(--text-muted)' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Ajukan Stok Masuk (Ke SPV)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Minta persetujuan tambahan stok dari SPV area Anda. Pengajuan dalam satuan kemasan utuh.
          </p>
        </div>
      </div>

      {/* Warehouse Source Toggle */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>🏭 Ambil Stok dari:</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {([['MAIN', '🏭 Gudang Utama (Accurate)', 'Alur persetujuan: SPV → FA Manager → WH Manager → SPV', '#dbeafe', '#1d4ed8'],
             ['SAMPLE', '🧪 Gudang Sampel', 'Alur persetujuan: SPV saja — lebih cepat', '#ede9fe', '#7c3aed']] as const).map(([val, label, desc, bg, color]) => (
            <label key={val} onClick={() => setWarehouseSource(val)}
              style={{
                flex: 1, minWidth: 220, cursor: 'pointer', padding: '0.85rem 1rem',
                border: `2px solid ${warehouseSource === val ? color : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', background: warehouseSource === val ? bg : 'white',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <input type="radio" name="warehouseSource" value={val} checked={warehouseSource === val} onChange={() => setWarehouseSource(val)} />
                <span style={{ fontWeight: 700, color }}>{label}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '1.4rem' }}>{desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Info sync freshness — only shown for MAIN warehouse */}
      {!isSample && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.9rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>🔄 Data stok SPV dari Accurate</span>
          {lastSyncedAt ? (
            <span style={{ color: new Date().getTime() - new Date(lastSyncedAt).getTime() > 3600000 ? '#d97706' : '#166534', fontWeight: 500 }}>
              Terakhir disinkron: {new Date(lastSyncedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {new Date().getTime() - new Date(lastSyncedAt).getTime() > 3600000 ? ' ⚠️ (lebih dari 1 jam lalu)' : ' ✓'}
            </span>
          ) : (
            <span style={{ color: '#d97706' }}>⚠️ Belum pernah disinkron — hubungi admin</span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>• Auto-sync setiap 30 menit</span>
        </div>
      )}

      {/* Sample warehouse info bar */}
      {isSample && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.9rem', background: '#ede9fe', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#5b21b6' }}>
          <span>🧪 Mode Permintaan Sampel</span>
          <span>Pilih produk yang dibutuhkan — SPV akan melakukan pengadaan. Stok akan ditransfer ke gudang Anda setelah sampel tersedia.</span>
        </div>
      )}

      <div className="card">
        {error && (
          <div style={{ marginBottom: '1rem', color: 'var(--danger)', background: '#fee2e2', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📦 Kebutuhan Produk</h3>

            <div className="picker-row">
              <div style={{ flex: 2 }}>
                <label className="form-label">Pilih Produk</label>
                <SearchableSelect
                  options={products.map(p => {
                    // Cross-reference with sample balance for informational label
                    const sampleBalance = sampleProducts.find(s => s.productId === p.id)?.balance ?? null
                    const sampleInfo = isSample
                      ? (sampleBalance != null && sampleBalance > 0
                          ? ` • 🧪 Stok Sampel: ${sampleBalance} ${p.unit}`
                          : ' • 🧪 Belum ada di gudang sampel')
                      : ` • Stok SPV: ${p.spvStock != null ? p.spvStock + ' ' + p.unit : 'N/A'}`
                    return {
                      value: p.id,
                      label: p.unitGramasi
                        ? `${p.name} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit}${sampleInfo}`
                        : `${p.name} (${p.unit})${sampleInfo}`,
                    }
                  })}
                  value={currentProduct}
                  onChange={setCurrentProduct}
                  placeholder={loadingProducts ? 'Memuat produk...' : '-- Ketik nama produk --'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">
                  Kuantitas ({selectedDetail?.unit || 'kemasan'})
                  {!isSample && selectedDetail?.spvStock != null && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      maks {selectedDetail.spvStock} {selectedDetail.unit}
                    </span>
                  )}
                  {isSample && currentSampleBalance != null && currentSampleBalance > 0 && (
                    <span style={{ fontWeight: 400, color: '#7c3aed', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      {currentSampleBalance} {selectedDetail?.unit} tersedia di sampel
                    </span>
                  )}
                </label>
                <input
                  type="number" step="1" min="1"
                  max={!isSample ? (selectedDetail?.spvStock ?? undefined) : undefined}
                  className="form-control"
                  value={currentQty}
                  onChange={e => setCurrentQty(e.target.value)}
                  placeholder="Jumlah kemasan"
                />
              </div>
              <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px', padding: '0 1.5rem' }}>Tambah</button>
            </div>

            {/* Info produk terpilih — SAMPLE mode */}
            {isSample && selectedDetail && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: '#ede9fe', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedDetail.unitGramasi && selectedDetail.gramasiPerUnit && (
                  <span>📐 <strong>{selectedDetail.gramasiPerUnit}{selectedDetail.unitGramasi}</strong> per {selectedDetail.unit}</span>
                )}
                {currentSampleBalance != null && currentSampleBalance > 0 ? (
                  <span style={{ color: '#5b21b6' }}>
                    🧪 Stok Sampel SPV: <strong>{currentSampleBalance} {selectedDetail.unit}</strong> (tersedia)
                  </span>
                ) : (
                  <span style={{ color: '#b45309' }}>
                    🧪 Belum ada di gudang sampel — SPV akan melakukan pengadaan
                  </span>
                )}
                <span style={{ color: '#92400e' }}>⚠️ Pengajuan hanya dalam kemasan utuh</span>
              </div>
            )}

            {/* Info produk terpilih — MAIN mode */}
            {!isSample && selectedDetail && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedDetail.unitGramasi && selectedDetail.gramasiPerUnit && (
                  <span>📐 <strong>{selectedDetail.gramasiPerUnit}{selectedDetail.unitGramasi}</strong> per {selectedDetail.unit}</span>
                )}
                <span style={{ color: selectedDetail.spvStock ? '#166534' : '#6b7280' }}>
                  🏪 Stok SPV: <strong>{formatSpvStock(selectedDetail.spvStock, selectedDetail.unit) ?? 'Belum tersinkron dari Accurate'}</strong>
                </span>
                {selectedDetail.spvStock != null && selectedDetail.unitGramasi && selectedDetail.gramasiPerUnit && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    = {(selectedDetail.spvStock * selectedDetail.gramasiPerUnit).toLocaleString('id-ID')}{selectedDetail.unitGramasi} total
                  </span>
                )}
                <span style={{ color: '#92400e' }}>⚠️ Pengajuan hanya dalam kemasan utuh</span>
              </div>
            )}

            {selectedProducts.length > 0 ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Produk</th>
                      <th style={thStyle}>Diajukan</th>
                      <th style={thStyle}>Setara Gramasi</th>
                      <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map(p => (
                      <tr key={p.productId}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {isSample ? (
                            p.spvStock != null && p.spvStock > 0 ? (
                              <div style={{ fontSize: '0.75rem', color: '#5b21b6' }}>🧪 Stok sampel: {p.spvStock} {p.unit}</div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#b45309' }}>🧪 Belum ada di sampel — pengadaan oleh SPV</div>
                            )
                          ) : (
                            p.spvStock != null && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok SPV: {p.spvStock} {p.unit}</div>
                            )
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.qtyRequested}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{p.unit}</span>
                        </td>
                        <td style={tdStyle}>
                          {p.unitGramasi && p.gramasiPerUnit ? (
                            <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                              {(p.qtyRequested * p.gramasiPerUnit).toLocaleString('id-ID')}{p.unitGramasi}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button type="button" onClick={() => removeProduct(p.productId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', marginTop: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                Belum ada produk yang ditambahkan.
              </div>
            )}
          </div>

          {/* ── Custom / Non-SKU Product Section (SAMPLE mode only) ──────────── */}
          {isSample && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>🆕 Produk Di Luar SKU</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Untuk produk yang belum terdaftar di sistem — isi detailnya secara manual
                </span>
              </div>

              {/* Input row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Nama Produk</label>
                  <input
                    type="text"
                    className="form-control"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Cth: Fungisida XYZ 500ml"
                  />
                </div>
                <div>
                  <label className="form-label">Satuan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                    placeholder="Cth: Btl, Kg, Pcs"
                  />
                </div>
                <div>
                  <label className="form-label">Jumlah</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="form-control"
                    value={customQty}
                    onChange={e => setCustomQty(e.target.value)}
                    placeholder="Qty"
                  />
                </div>
                <button
                  type="button"
                  onClick={addCustomProduct}
                  className="btn btn-outline"
                  style={{ height: '42px', padding: '0 1.5rem', whiteSpace: 'nowrap' }}
                >
                  Tambah
                </button>
              </div>
              {/* Optional notes for custom product */}
              <input
                type="text"
                className="form-control"
                value={customNotes}
                onChange={e => setCustomNotes(e.target.value)}
                placeholder="Keterangan tambahan (opsional) — misal: merek, kemasan, spesifikasi"
                style={{ marginBottom: '0.75rem' }}
              />

              {/* Custom product list */}
              {customProducts.length > 0 ? (
                <div style={{ border: '1px solid #c4b5fd', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, background: '#ede9fe' }}>Nama Produk</th>
                        <th style={{ ...thStyle, background: '#ede9fe' }}>Satuan</th>
                        <th style={{ ...thStyle, background: '#ede9fe' }}>Jumlah</th>
                        <th style={{ ...thStyle, background: '#ede9fe' }}>Keterangan</th>
                        <th style={{ ...thStyle, background: '#ede9fe', width: '50px', textAlign: 'center' }}>✕</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customProducts.map(c => (
                        <tr key={c.tempId}>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600, color: '#5b21b6' }}>🆕 {c.name}</span>
                          </td>
                          <td style={tdStyle}>{c.unit}</td>
                          <td style={tdStyle}><strong>{c.qty}</strong></td>
                          <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{c.notes || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button type="button" onClick={() => removeCustomProduct(c.tempId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.25rem', border: '1px dashed #c4b5fd', borderRadius: 'var(--radius-md)', color: '#7c3aed', fontSize: '0.85rem' }}>
                  Belum ada produk di luar SKU yang ditambahkan.
                </div>
              )}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Catatan Pengajuan <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              name="notes"
              className="form-control"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Stok untuk persiapan musim tanam bulan depan..."
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
            disabled={isPending || selectedProducts.length === 0}
          >
            {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Stok ke SPV'}
          </button>
        </form>
      </div>
    </div>
  )
}
