'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createProduct, updateProduct, deleteProduct } from '@/app/actions/master'
import ImportModal from '@/components/ImportModal'

type Product = { id: string; code: string | null; name: string; description: string | null; unit: string }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '460px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9rem', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.35rem' }

export default function ProductsMasterPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()
  const [showImport, setShowImport] = useState(false)

  const fetchData = async () => {
    const res = await fetch('/api/master/products')
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd()        { setSelected(null); setError(null); setModal('add') }
  function openEdit(p: Product) { setSelected(p); setError(null); setModal('edit') }
  function closeModal()     { setModal(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const res = modal === 'add'
        ? await createProduct(fd)
        : await updateProduct(selected!.id, fd)
      if (res?.error) { setError(res.error) }
      else { closeModal(); fetchData() }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus produk "${name}"?`)) return
    start(async () => {
      const res = await deleteProduct(id)
      if (res?.error) alert(res.error)
      else fetchData()
    })
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  return (
    <div>
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchData() }}
        />
      )}
      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={modalStyle}>
            <h3 style={{ marginBottom: '1.5rem' }}>{modal === 'add' ? '➕ Tambah Produk' : '✏️ Edit Produk'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>ID Produk</label>
                <input name="code" style={inputStyle} defaultValue={selected?.code || ''} placeholder="contoh: P001 (opsional)" />
              </div>
              <div>
                <label style={labelStyle}>Nama Produk <span style={{ color: 'red' }}>*</span></label>
                <input name="name" style={inputStyle} required defaultValue={selected?.name} placeholder="contoh: Pupuk Cair Bintang" />
              </div>
              <div>
                <label style={labelStyle}>Satuan Unit <span style={{ color: 'red' }}>*</span></label>
                <select name="unit" style={inputStyle} required defaultValue={selected?.unit || ''}>
                  <option value="">-- Pilih Satuan --</option>
                  <option value="ml">ml (mililiter)</option>
                  <option value="gr">gr (gram)</option>
                  <option value="kg">kg (kilogram)</option>
                  <option value="liter">liter</option>
                  <option value="pcs">pcs (pieces)</option>
                  <option value="sachet">sachet</option>
                  <option value="botol">botol</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Deskripsi</label>
                <textarea name="description" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} defaultValue={selected?.description || ''} placeholder="Keterangan singkat tentang produk..." />
              </div>
              {error && <div style={{ color: '#dc2626', fontSize: '0.875rem', background: '#fee2e2', padding: '0.6rem 0.9rem', borderRadius: '0.5rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isPending} style={{ flex: 1 }}>
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={closeModal} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
          <h2 style={{ margin: 0 }}>🧪 Master Data: Produk</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowImport(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📥 Import Excel</button>
          <button onClick={openAdd} className="btn btn-primary">➕ Tambah Produk</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {products.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0 }}>{p.name}</h3>
                  {p.code && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.1rem' }}>ID: {p.code}</div>}
                </div>
                <span className="badge badge-neutral">{p.unit}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {p.description || <em>Tidak ada deskripsi.</em>}
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => openEdit(p)} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>✏️ Edit</button>
              <button onClick={() => handleDelete(p.id, p.name)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'none', border: '1px solid var(--border)', borderRadius: '0.4rem', color: 'var(--danger)', cursor: 'pointer' }}>🗑️ Hapus</button>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>Belum ada data produk. Klik "Tambah Produk" untuk menambahkan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
