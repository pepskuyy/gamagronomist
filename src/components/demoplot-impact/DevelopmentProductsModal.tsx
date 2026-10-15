'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import DevelopmentProductImport from './DevelopmentProductImport'

export interface DevelopmentProduct {
  id: string
  name: string
  code?: string | null
  targetCrop?: string | null
  notes?: string | null
  isActive: boolean
}

interface CandidateProduct {
  id: string
  name: string
  code?: string | null
  unit?: string | null
  source?: 'accurate' | 'sales_invoice'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const API = '/api/demoplot-impact/development-products'

export default function DevelopmentProductsModal({ isOpen, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<DevelopmentProduct[]>([])
  const [candidates, setCandidates] = useState<CandidateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form input tambah produk baru
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [customName, setCustomName] = useState('')
  const [targetCrop, setTargetCrop] = useState('')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Selalu ambil data terbaru dari server (data global, bisa diubah akun lain)
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(API, { cache: 'no-store' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Gagal memuat produk pengembangan.')
      setProducts(Array.isArray(data.products) ? data.products : [])
      setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
    } catch (err: any) {
      console.error('Error loading dev products:', err)
      setProducts([])
      setLoadError(err.message || 'Gagal memuat produk pengembangan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setMsg(null)
    setSearchTerm('')
    setShowImport(false)
    setChanged(false)
    loadData()
  }, [isOpen, loadData])

  // Filter kandidat SKU berdasarkan pencarian live
  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) {
      return candidates
    }
    const term = searchTerm.toLowerCase().trim()
    return candidates.filter((c) => {
      const matchName = c.name.toLowerCase().includes(term)
      const matchCode = c.code ? c.code.toLowerCase().includes(term) : false
      return matchName || matchCode
    })
  }, [candidates, searchTerm])

  if (!isOpen) return null

  const canEdit = !loading && !loadError

  const handleClose = () => {
    if (changed) onSaved()
    onClose()
  }

  // Handle pilih dari dropdown select
  const handleSelectMaster = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedMasterId(val)
    if (val) {
      const found = candidates.find((m) => m.id === val)
      if (found) setCustomName(found.name)
    }
  }

  // Handle klik cepat dari tag suggestion
  const handleQuickPick = (item: CandidateProduct) => {
    setSelectedMasterId(item.id)
    setCustomName(item.name)
    setSearchTerm('')
  }

  // Tambah produk — langsung tersimpan ke database
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    const nameToAdd = customName.trim()
    if (!nameToAdd) {
      setMsg({ type: 'error', text: 'Nama produk tidak boleh kosong.' })
      return
    }

    const exists = products.some(
      (p) => p.name.toLowerCase() === nameToAdd.toLowerCase()
    )
    if (exists) {
      setMsg({ type: 'error', text: `Produk "${nameToAdd}" sudah terdaftar dalam daftar.` })
      return
    }

    const matched = candidates.find((m) => m.id === selectedMasterId)

    setAdding(true)
    setMsg(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{
            name: nameToAdd,
            code: matched?.code || null,
            targetCrop: targetCrop.trim() || null,
            notes: notes.trim() || null,
            isActive: true,
          }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan produk.')
      if (data.errors?.length) throw new Error(data.errors[0].reason)

      setSelectedMasterId('')
      setCustomName('')
      setTargetCrop('')
      setNotes('')
      setSearchTerm('')
      setChanged(true)
      setMsg({
        type: 'success',
        text: data.updated > 0
          ? `Produk "${nameToAdd}" sudah ada (ditambahkan akun lain) dan telah diperbarui.`
          : `Produk "${nameToAdd}" berhasil ditambahkan.`,
      })
      await loadData()
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setAdding(false)
    }
  }

  // Toggle status aktif — langsung tersimpan
  const handleToggleActive = async (prod: DevelopmentProduct) => {
    const next = !prod.isActive
    setBusyId(prod.id)
    setMsg(null)
    setProducts((list) => list.map((p) => (p.id === prod.id ? { ...p, isActive: next } : p)))
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prod.id, isActive: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status.')
      setChanged(true)
    } catch (err: any) {
      setProducts((list) => list.map((p) => (p.id === prod.id ? { ...p, isActive: prod.isActive } : p)))
      setMsg({ type: 'error', text: err.message })
      if (String(err.message).includes('tidak ditemukan')) loadData()
    } finally {
      setBusyId(null)
    }
  }

  // Hapus produk — langsung tersimpan
  const handleDelete = async (prod: DevelopmentProduct) => {
    if (!confirm(`Hapus produk "${prod.name}" dari list produk pengembangan?`)) return
    setBusyId(prod.id)
    setMsg(null)
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(prod.id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk.')
      setProducts((list) => list.filter((p) => p.id !== prod.id))
      setChanged(true)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: '1rem',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Kelola Produk Pengembangan & Fokus Penjualan
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Daftar SKU fokus yang diprioritaskan untuk pengawalan demo plot pasca penjualan oleh tim Sales
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '0.375rem',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.4rem 0.6rem',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Notifikasi feedback */}
        {msg && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.85rem',
              background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: msg.type === 'success' ? '#166534' : '#991b1b',
              borderBottom: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            {msg.type === 'success' ? '✅' : '⚠️'} {msg.text}
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Error saat memuat — form dikunci agar tidak menimpa data */}
          {loadError && (
            <div
              style={{
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.75rem',
                color: '#991b1b',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span>⚠️ {loadError} Perubahan dinonaktifkan sampai data berhasil dimuat.</span>
              <button
                type="button"
                onClick={loadData}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '0.375rem', border: '1px solid #fca5a5', background: '#ffffff', color: '#991b1b', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Import Excel */}
          {showImport && canEdit && (
            <DevelopmentProductImport
              candidates={candidates}
              existingNames={products.map((p) => p.name)}
              onCancel={() => setShowImport(false)}
              onImported={() => {
                setChanged(true)
                loadData()
              }}
            />
          )}

          {/* Form Tambah Produk */}
          {!showImport && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1.1rem 1.25rem',
              marginBottom: '1.5rem',
              opacity: canEdit ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                ➕ Tambah Produk Fokus Baru
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {loading ? 'Memuat produk...' : `Tersedia ${candidates.length} SKU Accurate`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  disabled={!canEdit}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '0.375rem',
                    border: '1px solid #16a34a',
                    background: '#f0fdf4',
                    color: '#166534',
                    cursor: canEdit ? 'pointer' : 'not-allowed',
                  }}
                >
                  📥 Import Excel
                </button>
              </div>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <fieldset disabled={!canEdit || adding} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Kolom Pencarian Cepat SKU */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                  🔍 Cari SKU Accurate (Ketik kata kunci untuk memfilter dropdown)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ketik nama atau kode produk, misal: Biogent, Ziflo, Tandem, Cabe, Jagung..."
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.84rem',
                      borderRadius: '0.375rem',
                      border: '1.5px solid #0284c7',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: 'pointer',
                        color: '#64748b',
                      }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Tag Quick-Pick jika ada hasil pencarian spesifik */}
              {searchTerm.trim().length >= 2 && filteredCandidates.length > 0 && (
                <div style={{ background: '#f1f5f9', padding: '0.6rem 0.75rem', borderRadius: '0.375rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>
                    ⚡ Klik langsung untuk memilih ({filteredCandidates.length} hasil):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '100px', overflowY: 'auto' }}>
                    {filteredCandidates.slice(0, 15).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleQuickPick(item)}
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          border: '1px solid #cbd5e1',
                          background: selectedMasterId === item.id ? '#0284c7' : '#ffffff',
                          color: selectedMasterId === item.id ? '#ffffff' : '#0f172a',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropdown Select SKU & Input Nama */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                      Pilih Dari Dropdown SKU Accurate
                    </label>
                    <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>
                      {filteredCandidates.length} SKU tampil
                    </span>
                  </div>
                  <select
                    value={selectedMasterId}
                    onChange={handleSelectMaster}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.82rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                    }}
                  >
                    <option value="">-- Pilih dari SKU Accurate ({filteredCandidates.length} SKU) --</option>
                    {filteredCandidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.code ? `[${m.code}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                    Nama Produk (atau ketik nama custom) *
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="misal: Biogent 50 SC"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.82rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>

              {/* Input Komoditas & Catatan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                    Target Komoditas / Sasaran Hama (Opsional)
                  </label>
                  <input
                    type="text"
                    value={targetCrop}
                    onChange={(e) => setTargetCrop(e.target.value)}
                    placeholder="misal: Padi, Jagung, Bawang Merah, Wereng"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.82rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                    Catatan Sasaran (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="misal: Fokus Penjualan Nasional Q1 2026"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.82rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '420px' }}>
                  💡 Produk dari SKU Accurate dicocokkan ke invoice per <strong>kode SKU</strong> (satu ukuran kemasan).
                  Nama custom tanpa kode (mis. &quot;Pronate&quot;) dicocokkan per <strong>nama</strong> (semua ukuran).
                </span>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {adding ? '⏳ Menyimpan...' : '➕ Tambahkan ke Daftar Produk Fokus'}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
          )}

          {/* Daftar Produk Fokus Saat Ini */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Daftar Produk Pengembangan Terdaftar ({products.filter((p) => p.isActive).length} Aktif / {products.length} Total)
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Produk aktif langsung dianalisis oleh mesin Opportunity Finder
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Memuat daftar produk...
              </div>
            ) : loadError ? null : products.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                }}
              >
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📦</div>
                <div style={{ fontWeight: 600 }}>Belum ada produk pengembangan yang didaftarkan.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Gunakan form di atas atau Import Excel untuk mendaftarkan produk prioritas penjualan Gama Agro.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: prod.isActive ? '#ffffff' : '#f1f5f9',
                      border: `1px solid ${prod.isActive ? '#cbd5e1' : '#e2e8f0'}`,
                      opacity: busyId === prod.id ? 0.5 : prod.isActive ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(prod)}
                        disabled={busyId === prod.id}
                        title={prod.isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        style={{
                          width: '36px',
                          height: '20px',
                          background: prod.isActive ? '#10b981' : '#cbd5e1',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: '2px',
                            left: prod.isActive ? '18px' : '2px',
                            transition: 'left 0.2s',
                          }}
                        />
                      </button>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {prod.name}
                          </span>
                          {prod.code && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.25rem',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontWeight: 600,
                              }}
                            >
                              {prod.code}
                            </span>
                          )}
                          {!prod.code && (
                            <span
                              title="Tanpa kode SKU: dicocokkan ke invoice berdasarkan nama, mencakup semua ukuran kemasan"
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.25rem',
                                background: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 600,
                              }}
                            >
                              cocok via nama
                            </span>
                          )}
                          {!prod.isActive && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.25rem',
                                background: '#f1f5f9',
                                color: '#64748b',
                              }}
                            >
                              Nonaktif
                            </span>
                          )}
                        </div>
                        {(prod.targetCrop || prod.notes) && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {prod.targetCrop && (
                              <span>
                                🌱 Komoditas: <strong>{prod.targetCrop}</strong>
                              </span>
                            )}
                            {prod.targetCrop && prod.notes && <span> • </span>}
                            {prod.notes && <span>📌 {prod.notes}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(prod)}
                      disabled={busyId === prod.id}
                      title="Hapus produk"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.9rem',
                        borderRadius: '0.25rem',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Setiap perubahan langsung tersimpan & berlaku untuk semua akun
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '0.375rem',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
