'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Settings, Plus, Loader2, FileText, Eye, Download, Pencil, Trash2, X, CheckCircle2, Paperclip, AlertTriangle } from 'lucide-react'

type Sop = {
  id: string
  title: string
  fileUrl: string
  fileName: string | null
  category: string
  author: { id: string; name: string; role: string }
  createdAt: string
  updatedAt: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Gudang:       { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--border)' },
  Lapangan:     { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--border)' },
  Administrasi: { bg: 'var(--info-bg)',    text: 'var(--info)',    border: 'var(--border)' },
  Keuangan:     { bg: 'var(--danger-bg)',  text: 'var(--danger)',  border: 'var(--border)' },
  Umum:         { bg: 'var(--surface-2)',  text: 'var(--text-secondary)', border: 'var(--border)' },
}

export default function SopClient({ role }: { role: string }) {
  const canEdit = ['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(role)

  const [sops, setSops] = useState<Sop[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [viewingSop, setViewingSop] = useState<Sop | null>(null)
  
  // PDF Viewer state
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfWidth, setPdfWidth] = useState(800)

  useEffect(() => {
    const updateWidth = () => setPdfWidth(Math.min(window.innerWidth * 0.9, 800))
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])
  // Categories state
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sopRes, catRes] = await Promise.all([
        fetch('/api/sop'),
        fetch('/api/sop-categories')
      ])
      const sopData = await sopRes.json()
      const catData = await catRes.json()
      
      if (Array.isArray(sopData)) setSops(sopData)
      if (Array.isArray(catData)) {
        setCategories(catData)
        if (!formCategory && catData.length > 0) {
          setFormCategory(catData[0].name)
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [formCategory])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    try {
      await fetch('/api/sop-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      })
      setNewCategoryName('')
      fetchData()
    } catch { alert('Gagal menambah kategori') }
  }

  async function handleUpdateCategory(id: string, name: string) {
    if (!name.trim()) return
    try {
      await fetch(`/api/sop-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      setEditingCategoryId(null)
      fetchData()
    } catch { alert('Gagal mengubah kategori') }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Yakin menghapus kategori ini? SOP yang ada tidak akan terhapus, namun nama kategorinya mungkin tidak sesuai.')) return
    try {
      await fetch(`/api/sop-categories/${id}`, { method: 'DELETE' })
      fetchData()
    } catch { alert('Gagal menghapus kategori') }
  }

  function openCreateForm() {
    setEditingId(null)
    setFormTitle('')
    setFormCategory(categories.length > 0 ? categories[0].name : '')
    setUploadedFileUrl('')
    setUploadedFileName('')
    setUploadError(null)
    setShowForm(true)
  }

  function openEditForm(sop: Sop) {
    setEditingId(sop.id)
    setFormTitle(sop.title)
    setFormCategory(sop.category)
    setUploadedFileUrl(sop.fileUrl)
    setUploadedFileName(sop.fileName || '')
    setUploadError(null)
    setShowForm(true)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setUploadError('Hanya file PDF yang diperbolehkan.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 20MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/sop/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Gagal mengunggah file.')
      } else {
        setUploadedFileUrl(data.url)
        setUploadedFileName(data.fileName || file.name)
        // Auto-fill title from filename if empty
        if (!formTitle.trim()) {
          setFormTitle(file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '))
        }
      }
    } catch {
      setUploadError('Gagal mengunggah file. Periksa koneksi internet.')
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!formTitle.trim() || !uploadedFileUrl) return
    setSaving(true)
    try {
      const body = { title: formTitle, fileUrl: uploadedFileUrl, fileName: uploadedFileName, category: formCategory }
      if (editingId) {
        await fetch(`/api/sop/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        await fetch('/api/sop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      setShowForm(false)
      setEditingId(null)
      fetchSops()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin ingin menghapus SOP ini?')) return
    await fetch(`/api/sop/${id}`, { method: 'DELETE' })
    if (viewingSop?.id === id) setViewingSop(null)
    fetchSops()
  }

  // Filtered list
  const filtered = sops.filter(s => {
    if (filterCategory && s.category !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    }
    return true
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, Sop[]>>((acc, sop) => {
    if (!acc[sop.category]) acc[sop.category] = []
    acc[sop.category].push(sop)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>SOP (Standard Operating Procedure)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Panduan prosedur operasional standar untuk seluruh tim
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowCategoryModal(true)}>
              <Settings size={16} strokeWidth={1.75} className="icon-inline" /> Kelola Kategori
            </button>
            <button className="btn btn-primary" onClick={openCreateForm}>
              <Plus size={16} strokeWidth={1.75} className="icon-inline" /> Upload SOP Baru
            </button>
          </div>
        )}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Cari SOP..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ maxWidth: 320, flex: 1 }}
        />
        <select className="form-control" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {categories.map(catObj => {
          const cat = catObj.name
          const count = sops.filter(s => s.category === cat).length
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Umum
          return (
            <button
              key={catObj.id}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 500,
                border: `1px solid ${filterCategory === cat ? colors.border : 'var(--border)'}`,
                background: filterCategory === cat ? colors.bg : 'var(--surface)',
                color: filterCategory === cat ? colors.text : 'var(--text-muted)',
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              {cat} (<span className="num">{count}</span>)
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Loader2 size={20} strokeWidth={1.75} style={{ animation: 'spin 0.8s linear infinite', marginBottom: '0.5rem' }} />
          <div>Memuat data SOP...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <FileText size={28} strokeWidth={1.5} style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }} />
          <p style={{ fontWeight: 500 }}>{searchQuery || filterCategory ? 'Tidak ada SOP yang cocok dengan filter.' : 'Belum ada SOP.'}</p>
          {canEdit && !searchQuery && !filterCategory && (
            <button className="btn btn-primary" onClick={openCreateForm} style={{ marginTop: '1rem' }}><Plus size={16} strokeWidth={1.75} className="icon-inline" /> Upload SOP Pertama</button>
          )}
        </div>
      )}

      {/* SOP List grouped by category */}
      {!loading && Object.entries(grouped).map(([category, items]) => {
        const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Umum
        return (
          <div key={category} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{
                padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-xs)', fontSize: '0.8rem', fontWeight: 500,
                background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
              }}>
                {category}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}><span className="num">{items.length}</span> dokumen</span>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {items.map(sop => (
                <div key={sop.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <FileText size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sop.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        Oleh {sop.author.name} • {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(sop.updatedAt))}
                        {sop.fileName && <span> • {sop.fileName}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setViewingSop(sop)}
                      style={{ fontSize: '0.78rem', padding: '0.375rem 0.75rem' }}
                    >
                      <Eye size={14} strokeWidth={1.75} className="icon-inline" /> Lihat
                    </button>
                    <a
                      href={sop.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.375rem 0.75rem', textDecoration: 'none' }}
                    >
                      <Download size={14} strokeWidth={1.75} className="icon-inline" /> Unduh
                    </a>
                    {canEdit && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => openEditForm(sop)} title="Edit" style={{ fontSize: '0.78rem', padding: '0.375rem 0.5rem' }}>
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(sop.id)} title="Hapus" style={{ fontSize: '0.78rem', padding: '0.375rem 0.5rem', color: 'var(--danger)' }}>
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* PDF Viewer Modal */}
      {viewingSop && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }} onClick={() => setViewingSop(null)} />
          <div style={{
            position: 'fixed', top: '2%', left: '2%', right: '2%', bottom: '2%',
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)', zIndex: 1001,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'slideUp 0.2s ease-out',
          }}>
            {/* Viewer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {viewingSop.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {viewingSop.category} • Oleh {viewingSop.author.name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <a
                  href={viewingSop.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  <Download size={14} strokeWidth={1.75} className="icon-inline" /> Unduh PDF
                </a>
                <button className="btn btn-outline btn-sm" onClick={() => setViewingSop(null)} title="Tutup" style={{ fontSize: '1rem', lineHeight: 1, padding: '0.375rem 0.5rem' }}>
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* PDF iframe via Google Docs Viewer */}
            <div style={{ flex: 1, background: '#525659' }}>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingSop.fileUrl)}&embedded=true`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={viewingSop.title}
              />
            </div>
          </div>
        </>
      )}

      {/* Upload / Edit Form Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={() => setShowForm(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)', padding: '1.75rem', width: '90%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
            zIndex: 1001, animation: 'slideUp 0.2s ease-out',
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.125rem' }}>
              {editingId ? 'Edit SOP' : 'Upload SOP Baru'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Judul SOP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" className="form-control" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="contoh: Prosedur Penerimaan Barang Gudang" />
              </div>

              {/* Category */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kategori <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* PDF Upload */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">File PDF <span style={{ color: 'var(--danger)' }}>*</span></label>

                {/* Current file indicator */}
                {uploadedFileUrl && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', marginBottom: '0.625rem',
                    background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  }}>
                    <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.82rem', color: 'var(--success)' }}>PDF berhasil diunggah</div>
                      {uploadedFileName && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uploadedFileName}</div>}
                    </div>
                    {editingId && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload baru untuk mengganti</span>
                    )}
                  </div>
                )}

                {/* Upload area */}
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  style={{
                    border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '1.5rem', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
                    background: 'var(--surface-2)', transition: 'var(--transition)',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  {uploading ? (
                    <div>
                      <Loader2 size={20} strokeWidth={1.75} style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', animation: 'spin 0.8s linear infinite' }} />
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mengunggah PDF...</div>
                    </div>
                  ) : (
                    <div>
                      <Paperclip size={20} strokeWidth={1.75} style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }} />
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Klik untuk pilih file PDF</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Maks 20MB • Format .pdf</div>
                    </div>
                  )}
                </div>

                {/* Upload error */}
                {uploadError && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                    <AlertTriangle size={14} strokeWidth={1.75} className="icon-inline" /> {uploadError}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)} disabled={saving || uploading}>Batal</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || uploading || !formTitle.trim() || !uploadedFileUrl}
              >
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan SOP'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Kelola Kategori SOP</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCategoryModal(false)} title="Tutup" style={{ lineHeight: 1, padding: '0.375rem 0.5rem' }}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                className="form-control" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru..." 
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleAddCategory}>Tambah</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  {editingCategoryId === cat.id ? (
                    <input 
                      type="text" 
                      className="form-control" 
                      defaultValue={cat.name}
                      autoFocus
                      onBlur={(e) => handleUpdateCategory(cat.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(cat.id, e.currentTarget.value)}
                    />
                  ) : (
                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditingCategoryId(cat.id)} title="Edit" style={{ padding: '0.375rem 0.5rem' }}><Pencil size={14} strokeWidth={1.75} /></button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleDeleteCategory(cat.id)} title="Hapus" style={{ color: 'var(--danger)', padding: '0.375rem 0.5rem' }}><Trash2 size={14} strokeWidth={1.75} /></button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada kategori.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
