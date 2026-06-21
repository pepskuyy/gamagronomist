'use client'

import { useEffect, useState, useCallback } from 'react'

type Sop = {
  id: string
  title: string
  content: string
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [saving, setSaving] = useState(false)

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
    setFormContent('')
    setFormCategory(CATEGORIES[0])
    setShowForm(true)
  }

  function openEditForm(sop: Sop) {
    setEditingId(sop.id)
    setFormTitle(sop.title)
    setFormContent(sop.content)
    setFormCategory(sop.category)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) return
    setSaving(true)
    try {
      const body = { title: formTitle, content: formContent, category: formCategory }
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
    if (expandedId === id) setExpandedId(null)
    fetchSops()
  }

  // Filtered list
  const filtered = sops.filter(s => {
    if (filterCategory && s.category !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
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
            ＋ Buat SOP Baru
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

      {/* Stats */}
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
            <button className="btn btn-primary" onClick={openCreateForm} style={{ marginTop: '1rem' }}>＋ Buat SOP Pertama</button>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map(sop => {
                const isExpanded = expandedId === sop.id
                return (
                  <div key={sop.id} className="card" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? `1.5px solid ${colors.border}` : undefined }}>
                    {/* Title row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : sop.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1.15rem', cursor: 'pointer',
                        background: isExpanded ? colors.bg : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{isExpanded ? '📖' : '📋'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sop.title}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Oleh {sop.author.name} • {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(sop.updatedAt))}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                        ▼
                      </span>
                    </div>

                    {/* Content - expandable */}
                    {isExpanded && (
                      <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border)' }}>
                        {/* Render content with line breaks */}
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-main)' }}>
                          {sop.content}
                        </div>

                        {/* Actions for editors */}
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openEditForm(sop) }} style={{ fontSize: '0.8rem' }}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(sop.id) }} style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                              🗑️ Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Modal Form */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={() => setShowForm(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: '1.75rem', width: '90%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
            zIndex: 1001, animation: 'slideUp 0.2s ease-out',
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem' }}>
              {editingId ? '✏️ Edit SOP' : '📖 Buat SOP Baru'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Judul SOP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" className="form-control" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="contoh: Prosedur Penerimaan Barang Gudang" />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kategori <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Konten SOP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  className="form-control"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  rows={12}
                  placeholder={'Tuliskan langkah-langkah prosedur di sini...\n\n1. Langkah pertama\n2. Langkah kedua\n3. dst.'}
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.65 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formTitle.trim() || !formContent.trim()}>
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan SOP'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
