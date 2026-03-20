'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RegionSelect from '@/components/RegionSelect'
import GpsCapture from '@/components/GpsCapture'
import { submitAfaSelfPlan } from '@/app/actions/afa-plan'

type Product = { id: string; name: string; unit: string }
type SelectedProduct = { productId: string; qtyRequested: number; name: string; unit: string }

export default function AfaSelfPlanPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [currentProduct, setCurrentProduct] = useState('')
  const [currentQty, setCurrentQty] = useState('')
  const [area, setArea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(setProducts)
  }, [])

  function addProduct() {
    if (!currentProduct || !currentQty || Number(currentQty) <= 0) return
    if (selectedProducts.length >= 5) return alert('Maksimal 5 produk.')
    if (selectedProducts.find(p => p.productId === currentProduct)) return alert('Produk sudah ada.')
    const detail = products.find(p => p.id === currentProduct)
    if (detail) {
      setSelectedProducts(prev => [...prev, { productId: detail.id, qtyRequested: Number(currentQty), name: detail.name, unit: detail.unit }])
      setCurrentProduct(''); setCurrentQty('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedProducts.length === 0) { setError('Pilih minimal 1 produk.'); return }
    if (lat === null || lng === null) { setError('Lokasi GPS wajib diambil sebelum mengirim.'); return }
    setLoading(true); setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('products', JSON.stringify(selectedProducts.map(p => ({ productId: p.productId, qtyRequested: p.qtyRequested }))))
    fd.append('latitude', String(lat))
    fd.append('longitude', String(lng))
    const res = await submitAfaSelfPlan(fd)
    if (res?.error) { setError(res.error); setLoading(false) }
    else router.push('/dashboard/demoplot')
  }

  const tdStyle = { padding: '0.65rem', borderBottom: '1px solid var(--border)' }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <Link href="/dashboard/demoplot" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Kembali</Link>
        <div>
          <h2 style={{ margin: 0 }}>Perencanaan Demo Plot Mandiri</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
            ✅ Langsung Disetujui — Tanpa Perlu Approval SPV
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#1e40af' }}>
        <strong>ℹ️ Tentang Perencanaan Mandiri:</strong> Sebagai AFA, kamu bisa langsung membuat rencana demo plot sendiri.
        Perencanaan ini tidak memerlukan persetujuan dari SPV. Kamu juga yang akan mengeksekusi (realisasi) demo plot ini.
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>👤 Data Petani &amp; Area</h3>
            <div className="form-group">
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="farmerName" type="text" className="form-control" required placeholder="Bpk. Budi" />
            </div>
            <div className="form-group">
              <label className="form-label">No. Telepon (Opsional)</label>
              <input name="farmerPhone" type="text" className="form-control" placeholder="0812xxx" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Area (Provinsi Jawa Tengah) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <RegionSelect onChangeFullString={setArea} />
              <input type="hidden" name="area" value={area} />
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Area yang akan disimpan: <strong>{area || '-'}</strong>
              </p>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>📋 Detail Rencana</h3>
            <div className="form-group">
              <label className="form-label">Komoditas <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input name="commodity" type="text" className="form-control" required placeholder="Padi / Jagung / Bawang" />
            </div>
            <div className="form-group">
              <label className="form-label">Masalah Utama <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea name="problem" className="form-control" rows={2} required placeholder="Hama wereng mengganas..." />
            </div>
            <div className="form-group">
              <label className="form-label">Rencana Demo Plot <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea name="plan" className="form-control" rows={2} required placeholder="Rencana semprot 2x interval 1 minggu..." />
            </div>
          </div>
        </div>

        {/* Product picker */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>📦 Kebutuhan Produk dari Stok Sendiri (Maks 5)</h3>
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>
          )}

          <div className="picker-row">
            <div style={{ flex: 2 }}>
              <label className="form-label">Pilih Produk</label>
              <select className="form-control" value={currentProduct} onChange={e => setCurrentProduct(e.target.value)}>
                <option value="">-- Pilih --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Kuantitas</label>
              <input type="number" step="0.01" min="1" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} />
            </div>
            <button type="button" onClick={addProduct} className="btn btn-outline" style={{ height: '42px' }}>Tambah</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '0.75rem' }}>
            <thead style={{ background: 'var(--surface-hover)' }}>
              <tr>
                <th style={tdStyle}>Produk</th>
                <th style={tdStyle}>Qty Direncanakan</th>
                <th style={{ ...tdStyle, width: '60px' }}>Hapus</th>
              </tr>
            </thead>
            <tbody>
              {selectedProducts.map(p => (
                <tr key={p.productId}>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>{p.qtyRequested} {p.unit}</td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => setSelectedProducts(prev => prev.filter(x => x.productId !== p.productId))} style={{ color: 'var(--danger)', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
              {selectedProducts.length === 0 && (
                <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada produk</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} disabled={loading || lat === null}>
          {loading ? 'Menyimpan Perencanaan...' : lat === null ? '📍 Ambil Lokasi GPS Dulu' : '✅ Simpan & Langsung Setujui'}
        </button>
      </form>
    </div>
  )
}
