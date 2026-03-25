'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createProduct, updateProduct, deleteProduct, bulkDeleteProducts } from '@/app/actions/master'
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
  const [search, setSearch]       = useState('')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

  const thStyle: React.CSSProperties = { padding: '0.7rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }

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

  function handleBulkDelete() {
    if (!selectedProducts.size) return
    if (!confirm(`Hapus ${selectedProducts.size} produk yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
    start(async () => {
      const res = await bulkDeleteProducts(Array.from(selectedProducts))
      if (res?.error) alert(res.error)
      else { setSelectedProducts(new Set()); fetchData() }
    })
  }

  function toggleProduct(id: string) {
    setSelectedProducts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllProducts(checked: boolean) {
    setSelectedProducts(checked ? new Set(filteredProducts.map(p => p.id)) : new Set())
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code?.toLowerCase().includes(search.toLowerCase())
  )

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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
             type="text" 
             placeholder="Cari produk (nama / ID)..." 
             className="form-control" 
             style={{ minWidth: '250px' }} 
             value={search}
             onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setShowImport(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📥 Import Excel</button>
          <button onClick={openAdd} className="btn btn-primary">➕ Tambah Produk</button>
        </div>
      </div>

      {/* Bulk delete bar */}
      {selectedProducts.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedProducts.size} produk dipilih</span>
          <button onClick={handleBulkDelete} disabled={isPending} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>🗑️ Hapus yang Dipilih</button>
          <button onClick={() => setSelectedProducts(new Set())} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>✕ Batal</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length} onChange={e => toggleAllProducts(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
                <th style={{...thStyle, width: '15%'}}>ID Produk</th>
                <th style={{...thStyle, width: '30%'}}>Nama Produk</th>
                <th style={{...thStyle, width: '15%'}}>Satuan</th>
                <th style={{...thStyle, width: '25%'}}>Deskripsi</th>
                <th style={{...thStyle, width: '15%', textAlign: 'center'}}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="fo-stock-row" style={{ background: selectedProducts.has(p.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={{...tdStyle, width: '40px', textAlign: 'center'}}>
                    <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={{...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.code || '—'}</td>
                  <td style={{...tdStyle, fontWeight: 600, color: 'var(--primary)'}}>{p.name}</td>
                  <td style={{...tdStyle}}><span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>{p.unit}</span></td>
                  <td style={{...tdStyle, color: 'var(--text-muted)'}}>{p.description || '—'}</td>
                  <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>
                    <button onClick={() => openEdit(p)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginRight: '0.4rem' }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(p.id, p.name)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.4rem', color: '#b91c1c', cursor: 'pointer' }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada data produk atau produk tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
