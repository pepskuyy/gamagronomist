'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
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

const CATEGORIES = ['Gudang', 'Lapangan', 'Administrasi', 'Keuangan', 'Umum']

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Gudang:       { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  Lapangan:     { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  Administrasi: { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' },
  Keuangan:     { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
  Umum:         { bg: '#f3e8ff', text: '#6b21a8', border: '#a78bfa' },
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
  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchSops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sop')
      const data = await res.json()
      if (Array.isArray(data)) setSops(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSops() }, [fetchSops])

  function openCreateForm() {
    setEditingId(null)
    setFormTitle('')
    setFormCategory(CATEGORIES[0])
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
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>📖 SOP (Standard Operating Procedure)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Panduan prosedur operasional standar untuk seluruh tim
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openCreateForm} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ＋ Upload SOP Baru
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Cari SOP..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ maxWidth: 320, flex: 1 }}
        />
        <select className="form-control" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const count = sops.filter(s => s.category === cat).length
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Umum
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              style={{
                padding: '0.4rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                border: `1.5px solid ${filterCategory === cat ? colors.border : 'var(--border)'}`,
                background: filterCategory === cat ? colors.bg : 'var(--surface)',
                color: filterCategory === cat ? colors.text : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Memuat data SOP...
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <p style={{ fontWeight: 600 }}>{searchQuery || filterCategory ? 'Tidak ada SOP yang cocok dengan filter.' : 'Belum ada SOP.'}</p>
          {canEdit && !searchQuery && !filterCategory && (
            <button className="btn btn-primary" onClick={openCreateForm} style={{ marginTop: '1rem' }}>＋ Upload SOP Pertama</button>
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
                padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
              }}>
                {category}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{items.length} dokumen</span>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {items.map(sop => (
                <div key={sop.id} className="card" style={{ padding: '0.85rem 1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>📄</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sop.title}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Oleh {sop.author.name} • {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(sop.updatedAt))}
                        {sop.fileName && <span> • {sop.fileName}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setViewingSop(sop)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      👁️ Lihat
                    </button>
                    <a
                      href={sop.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                    >
                      ⬇️ Unduh
                    </a>
                    {canEdit && (
                      <>
                        <button className="btn btn-sm" onClick={() => openEditForm(sop)} style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}>
                          ✏️
                        </button>
                        <button className="btn btn-sm" onClick={() => handleDelete(sop.id)} style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', color: 'var(--danger)' }}>
                          🗑️
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
            background: 'var(--surface)', borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)', zIndex: 1001,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'slideUp 0.2s ease-out',
          }}>
            {/* Viewer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📖 {viewingSop.title}
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
                  className="btn btn-sm"
                  style={{ fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  ⬇️ Unduh PDF
                </a>
                <button className="btn btn-sm" onClick={() => setViewingSop(null)} style={{ fontSize: '1rem', lineHeight: 1, padding: '0.3rem 0.6rem' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* PDF viewer */}
            <div style={{ flex: 1, background: '#525659', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <Document
                file={viewingSop.fileUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div style={{ padding: '2rem', color: '#fff' }}>Memuat PDF... ⏳</div>}
                error={<div style={{ padding: '2rem', color: '#fff', textAlign: 'center' }}>
                  <p style={{ marginBottom: '1rem' }}>Gagal memuat pratinjau PDF.</p>
                  <a href={viewingSop.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    ⬇️ Unduh File
                  </a>
                </div>}
              >
                {Array.from(new Array(numPages || 0), (el, index) => (
                  <div key={`page_${index + 1}`} style={{ marginBottom: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <Page 
                      pageNumber={index + 1} 
                      width={pdfWidth} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                    />
                  </div>
                ))}
              </Document>
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
            background: 'var(--surface)', borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: '1.75rem', width: '90%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
            zIndex: 1001, animation: 'slideUp 0.2s ease-out',
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem' }}>
              {editingId ? '✏️ Edit SOP' : '📖 Upload SOP Baru'}
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
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* PDF Upload */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">File PDF <span style={{ color: 'var(--danger)' }}>*</span></label>

                {/* Current file indicator */}
                {uploadedFileUrl && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', marginBottom: '0.6rem',
                    background: '#d1fae5', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid #34d399',
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#065f46' }}>PDF berhasil diunggah</div>
                      {uploadedFileName && <div style={{ fontSize: '0.75rem', color: '#047857', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uploadedFileName}</div>}
                    </div>
                    {editingId && (
                      <span style={{ fontSize: '0.72rem', color: '#065f46' }}>Upload baru untuk mengganti</span>
                    )}
                  </div>
                )}

                {/* Upload area */}
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm, 6px)',
                    padding: '1.5rem', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
                    background: 'var(--surface-hover, #f8fafc)', transition: 'border-color 0.15s',
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
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>⏳</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mengunggah PDF...</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📎</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Klik untuk pilih file PDF</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Maks 20MB • Format .pdf</div>
                    </div>
                  )}
                </div>

                {/* Upload error */}
                {uploadError && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.8rem' }}>
                    ⚠️ {uploadError}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => setShowForm(false)} disabled={saving || uploading}>Batal</button>
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
    </div>
  )
}
