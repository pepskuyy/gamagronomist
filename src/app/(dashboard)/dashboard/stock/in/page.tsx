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
type SelectedProduct = {
  productId:      string
  qtyRequested:   number
  name:           string
  unit:           string
  unitGramasi?:   string | null
  gramasiPerUnit?:number | null
  spvStock?:      number | null
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

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct]     = useState('')
  const [currentQty, setCurrentQty]             = useState('')
  const [notes, setNotes]               = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

  useEffect(() => {
    fetch('/api/spv-stock')
      .then(r => r.json())
      .then(data => {
        setProducts(data.products ?? [])
        setLastSyncedAt(data.lastSyncedAt ?? null)
        setLoadingProducts(false)
      })
      .catch(() => setLoadingProducts(false))
  }, [])

  const selectedDetail = products.find(p => p.id === currentProduct)

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

    // Validasi tidak boleh melebihi stok SPV
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (selectedProducts.length === 0) {
      setError('Masukkan minimal satu produk untuk diajukan.'); return
    }
    const payload = selectedProducts.map(p => ({
      productId: p.productId,
      qtyRequested: p.qtyRequested,
    }))
    const formData = new FormData()
    formData.append('notes', notes)
    formData.append('products', JSON.stringify(payload))
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

      {/* Info sync freshness */}
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
                  options={products.map(p => ({
                    value: p.id,
                    label: p.unitGramasi
                      ? `${p.name} — ${p.gramasiPerUnit}${p.unitGramasi}/${p.unit} • Stok SPV: ${p.spvStock != null ? p.spvStock + ' ' + p.unit : 'N/A'}`
                      : `${p.name} (${p.unit}) • Stok SPV: ${p.spvStock != null ? p.spvStock + ' ' + p.unit : 'N/A'}`,
                  }))}
                  value={currentProduct}
                  onChange={setCurrentProduct}
                  placeholder={loadingProducts ? 'Memuat produk...' : '-- Ketik nama produk --'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">
                  Kuantitas ({selectedDetail?.unit || 'kemasan'})
                  {selectedDetail?.spvStock != null && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      maks {selectedDetail.spvStock} {selectedDetail.unit}
                    </span>
                  )}
                </label>
                <input
                  type="number" step="1" min="1"
                  max={selectedDetail?.spvStock ?? undefined}
                  className="form-control"
                  value={currentQty}
                  onChange={e => setCurrentQty(e.target.value)}
                  placeholder="Jumlah kemasan"
                />
              </div>
              <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px', padding: '0 1.5rem' }}>Tambah</button>
            </div>

            {/* Info produk terpilih */}
            {selectedDetail && (
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
                          {p.spvStock != null && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Stok SPV: {p.spvStock} {p.unit}
                            </div>
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
