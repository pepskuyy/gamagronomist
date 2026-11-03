'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createProduct, updateProduct, deleteProduct, bulkDeleteProducts } from '@/app/actions/master'
import { stockUnitMode, suggestGramasiFromName } from '@/lib/stock-units'
import { Plus, Pencil, Trash2, RefreshCw, Upload, Download, PauseCircle, CheckCircle2, XCircle, AlertTriangle, X, Check } from 'lucide-react'

// Modal import hanya dimuat saat dibuka
const ImportModal = dynamic(() => import('@/components/ImportModal'), { ssr: false })

type Product = { id: string; code: string | null; name: string; description: string | null; unit: string; unitGramasi?: string | null; gramasiPerUnit?: number | null; stockUnitMode?: string | null; spvStock?: number | null }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
}
const modalStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%', maxWidth: '460px',
  boxShadow: 'var(--shadow-lg)'
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }

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
  const [syncing, setSyncing]   = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string; detail?: string } | null>(null)
  // Satuan stok: produk "belum ditentukan" menahan stok masuk sampai admin memutuskan
  const [onlyUndecided, setOnlyUndecided] = useState(false)
  const [formName, setFormName] = useState('')
  const [formUnitGramasi, setFormUnitGramasi] = useState('')
  const [formGramasi, setFormGramasi] = useState('')
  const [formMode, setFormMode] = useState('')

  useEffect(() => {
    // Tautan dari notifikasi admin: /dashboard/master/products?satuan=belum
    if (new URLSearchParams(window.location.search).get('satuan') === 'belum') setOnlyUndecided(true)
  }, [])

  const thStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)' }

  const fetchData = async () => {
    const res = await fetch('/api/master/products')
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function fillForm(p: Product | null) {
    setFormName(p?.name ?? '')
    setFormUnitGramasi(p?.unitGramasi ?? '')
    setFormGramasi(p?.gramasiPerUnit != null ? String(p.gramasiPerUnit) : '')
    setFormMode(p?.stockUnitMode === 'KEMASAN' ? 'KEMASAN' : '')
  }
  function openAdd()        { setSelected(null); fillForm(null); setError(null); setModal('add') }
  function openEdit(p: Product) { setSelected(p); fillForm(p); setError(null); setModal('edit') }
  function closeModal()     { setModal(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      let res: any = modal === 'add'
        ? await createProduct(fd)
        : await updateProduct(selected!.id, fd)
      if (res?.needConfirm) {
        if (!confirm(`${res.warning}`)) return
        fd.set('confirmGramasiChange', 'true')
        res = await updateProduct(selected!.id, fd)
      }
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

  async function handleExportExcel() {
    if (products.length === 0) { alert('Belum ada data produk untuk diekspor.'); return }
    const XLSX = await import('xlsx') // lazy-load
    const data = [
      ['id_db', 'id_produk', 'nama_produk', 'satuan_kemasan', 'satuan_gramasi', 'gramasi_per_kemasan', 'deskripsi'],
      ...products.map(p => [p.id, p.code || '', p.name, p.unit, p.unitGramasi || '', p.gramasiPerUnit ?? '', p.description || ''])
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, `master_produk_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  async function handleAccurateSync() {
    if (!confirm('Sinkronisasi produk dari Accurate Online?\n\n• Nama produk yang sudah ada akan diperbarui\n• Produk baru dari Accurate akan ditambahkan dengan satuan default (PCS)\n• Satuan kemasan & gramasi tidak akan berubah')) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/accurate-sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncResult({ ok: false, msg: data.error })
      } else {
        setSyncResult({
          ok: true,
          msg: data.message,
          detail: `Total dari Accurate: ${data.total} produk`
        })
        fetchData()
      }
    } catch {
      setSyncResult({ ok: false, msg: 'Gagal menghubungi server. Cek koneksi.' })
    } finally {
      setSyncing(false)
    }
  }

  function toggleProduct(id: string) {
    setSelectedProducts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllProducts(checked: boolean) {
    setSelectedProducts(checked ? new Set(filteredProducts.map(p => p.id)) : new Set())
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Memuat data...</div>

  const isUndecided = (p: Product) => stockUnitMode(p) === null
  const undecidedCount = products.filter(isUndecided).length
  const filteredProducts = products.filter(p =>
    (!onlyUndecided || isUndecided(p)) && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase())
    )
  )
  const formHasGramasi = !!formUnitGramasi && Number(formGramasi) > 0
  const nameSuggestion = suggestGramasiFromName(formName)

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
            <h3 style={{ marginBottom: '1.5rem' }}>{modal === 'add' ? 'Tambah Produk' : 'Edit Produk'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>ID Produk</label>
                <input name="code" style={inputStyle} defaultValue={selected?.code || ''} placeholder="contoh: P001 (opsional)" />
              </div>
              <div>
                <label style={labelStyle}>Nama Produk <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input name="name" style={inputStyle} required value={formName} onChange={e => setFormName(e.target.value)} placeholder="contoh: Fungisida Bintang" />
              </div>
              <div>
                <label style={labelStyle}>Satuan Kemasan <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select name="unit" style={inputStyle} required defaultValue={selected?.unit || ''}>
                  <option value="">-- Pilih Satuan Kemasan --</option>
                  <option value="PCS">PCS (pieces satuan)</option>
                  <option value="Btl">Btl (botol)</option>
                  <option value="Bks">Bks (bungkus)</option>
                  <option value="Box">Box</option>
                  <option value="Sak">Sak</option>
                  <option value="gl">gl (galon)</option>
                  <option value="Pack">Pack</option>
                  <option value="Rol">Rol</option>
                </select>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: 0 }}>Satuan saat AFA mengajukan stok dari SPV/gudang</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Satuan Gramasi</label>
                  <select name="unitGramasi" style={inputStyle} value={formUnitGramasi} onChange={e => setFormUnitGramasi(e.target.value)}>
                    <option value="">-- Tidak Ada --</option>
                    <option value="ml">ml (liquid)</option>
                    <option value="gr">gr (non-liquid)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Isi per Kemasan</label>
                  <input name="gramasiPerUnit" type="number" step="0.01" min="0" style={inputStyle} value={formGramasi} onChange={e => setFormGramasi(e.target.value)} placeholder="misal: 500" />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>Contoh: Fungisida 500ml/Btl → pilih ml, isi 500. Digunakan FO saat request eceran.</p>
              {!formHasGramasi && nameSuggestion && (
                <div style={{ marginTop: '-0.5rem', fontSize: '0.8rem', background: 'var(--info-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span>Saran dari nama: <strong>{nameSuggestion.gramasiPerUnit} {nameSuggestion.unitGramasi}</strong> per kemasan</span>
                  <button type="button" className="btn btn-outline" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                    onClick={() => { setFormUnitGramasi(nameSuggestion.unitGramasi); setFormGramasi(String(nameSuggestion.gramasiPerUnit)) }}>
                    Pakai saran
                  </button>
                </div>
              )}
              <div>
                <label style={labelStyle}>Satuan Stok</label>
                {formHasGramasi ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--success)' }}><Check size={14} strokeWidth={1.75} className="icon-inline" /> Stok dihitung dalam {formUnitGramasi} (isi per kemasan terisi)</div>
                ) : (
                  <select name="stockUnitMode" style={inputStyle} value={formMode} onChange={e => setFormMode(e.target.value)}>
                    <option value="">Belum ditentukan (stok masuk ditahan)</option>
                    <option value="KEMASAN">Kemasan utuh (tanpa gramasi, dihitung per kemasan)</option>
                  </select>
                )}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                  Isi gramasi untuk produk cair/bubuk. Pilih &quot;Kemasan utuh&quot; hanya untuk barang yang selalu keluar utuh (mis. alat, benih per pak).
                </p>
              </div>
              <div>
                <label style={labelStyle}>Deskripsi</label>
                <textarea name="description" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} defaultValue={selected?.description || ''} placeholder="Keterangan singkat tentang produk..." />
              </div>
              {error && <div style={{ color: 'var(--danger)', fontSize: '0.875rem', background: 'var(--danger-bg)', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
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
          <h2 style={{ margin: 0 }}>Master Data: Produk</h2>
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
          <button
            onClick={handleAccurateSync}
            disabled={syncing}
            className="btn btn-outline"
            style={{ background: syncing ? 'var(--surface-2)' : undefined }}
            title="Sinkronisasi nama & SKU produk dari Accurate Online"
          >
            {syncing ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--text-muted)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Menyinkronkan...</> : <><RefreshCw size={16} strokeWidth={1.75} className="icon-inline" /> Sync Accurate</>}
          </button>
          <button onClick={handleExportExcel} className="btn btn-outline"><Upload size={16} strokeWidth={1.75} className="icon-inline" /> Export Excel</button>
          <button onClick={() => setShowImport(true)} className="btn btn-outline"><Download size={16} strokeWidth={1.75} className="icon-inline" /> Import Excel</button>
          <button
            onClick={() => setOnlyUndecided(v => !v)}
            className={onlyUndecided ? 'btn btn-primary' : 'btn btn-outline'}
            title="Produk yang isi per kemasannya belum diisi. Stok masuk untuk produk ini ditahan."
          >
            <PauseCircle size={16} strokeWidth={1.75} className="icon-inline" /> Satuan belum ditentukan (<span className="num">{undecidedCount}</span>)
          </button>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={16} strokeWidth={1.75} className="icon-inline" /> Tambah Produk</button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
          padding: '0.75rem 1rem',
          background: syncResult.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}>
          <div>
            <div style={{ fontWeight: 500, color: syncResult.ok ? 'var(--success)' : 'var(--danger)' }}>
              {syncResult.ok ? <CheckCircle2 size={16} strokeWidth={1.75} className="icon-inline" /> : <XCircle size={16} strokeWidth={1.75} className="icon-inline" />} {syncResult.msg}
            </div>
            {syncResult.detail && <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.8rem' }}>{syncResult.detail}</div>}
            {syncResult.ok && <div style={{ color: 'var(--warning)', marginTop: '0.25rem', fontSize: '0.78rem' }}><AlertTriangle size={14} strokeWidth={1.75} className="icon-inline" /> Produk baru dari Accurate ditambahkan dengan satuan <strong>PCS</strong> — harap perbarui satuan kemasan & gramasi secara manual.</div>}
          </div>
          <button onClick={() => setSyncResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '0 0.25rem' }}><X size={16} strokeWidth={1.75} className="icon-inline" /></button>
        </div>
      )}

      {/* Bulk delete bar */}
      {selectedProducts.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 1rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}><span className="num">{selectedProducts.size}</span> produk dipilih</span>
          <button onClick={handleBulkDelete} disabled={isPending} className="btn btn-danger" style={{ padding: '0.375rem 0.875rem', fontSize: '0.82rem' }}><Trash2 size={16} strokeWidth={1.75} className="icon-inline" /> Hapus yang Dipilih</button>
          <button onClick={() => setSelectedProducts(new Set())} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.82rem' }}><X size={16} strokeWidth={1.75} className="icon-inline" /> Batal</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{...thStyle, width: '40px', textAlign: 'center'}}>
                  <input type="checkbox" checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length} onChange={e => toggleAllProducts(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                </th>
                <th style={{...thStyle, width: '11%'}}>ID Produk</th>
                <th style={{...thStyle, width: '25%'}}>Nama Produk</th>
                <th style={{...thStyle, width: '10%'}}>Kemasan</th>
                <th style={{...thStyle, width: '14%'}}>Gramasi</th>
                <th style={{...thStyle, width: '12%', textAlign: 'right'}}>Stok SPV</th>
                <th style={{...thStyle, width: '18%'}}>Deskripsi</th>
                <th style={{...thStyle, width: '10%', textAlign: 'center'}}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="fo-stock-row" style={{ background: selectedProducts.has(p.id) ? 'var(--primary-light)' : undefined }}>
                  <td style={{...tdStyle, width: '40px', textAlign: 'center'}}>
                    <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem' }} />
                  </td>
                  <td style={{...tdStyle, fontFamily: 'var(--font-mono-stack)', fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.code || '—'}</td>
                  <td style={{...tdStyle, fontWeight: 500, color: 'var(--text-main)'}}>{p.name}</td>
                  <td style={{...tdStyle}}><span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>{p.unit}</span></td>
                  <td style={{...tdStyle}}>
                    {stockUnitMode(p) === 'GRAMASI' ? (
                      <span className="badge num" style={{ fontSize: '0.75rem', background: 'var(--info-bg)', color: 'var(--info)' }}>
                        {p.gramasiPerUnit}{p.unitGramasi}/{p.unit}
                      </span>
                    ) : stockUnitMode(p) === 'KEMASAN' ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Kemasan utuh</span>
                    ) : (
                      <span title="Stok masuk ditahan sampai isi per kemasan diisi atau ditandai Kemasan utuh" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <PauseCircle size={14} strokeWidth={1.75} /> Belum ditentukan{(() => { const sg = suggestGramasiFromName(p.name); return sg ? ` · saran ${sg.gramasiPerUnit}${sg.unitGramasi}` : '' })()}
                      </span>
                    )}
                  </td>
                  <td style={{...tdStyle, textAlign: 'right'}}>
                    {p.spvStock != null ? (
                      <span style={{ fontWeight: 600, color: p.spvStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        <span className="num">{p.spvStock.toLocaleString('id-ID')}</span> <span className="unit">{p.unit}</span>
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                  </td>
                  <td style={{...tdStyle, color: 'var(--text-muted)'}}>{p.description || '—'}</td>
                  <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>
                    <button onClick={() => openEdit(p)} className="btn btn-outline" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', marginRight: '0.5rem' }}><Pencil size={14} strokeWidth={1.75} className="icon-inline" /> Edit</button>
                    <button onClick={() => handleDelete(p.id, p.name)} title="Hapus" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--danger-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}><Trash2 size={14} strokeWidth={1.75} /></button>
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
