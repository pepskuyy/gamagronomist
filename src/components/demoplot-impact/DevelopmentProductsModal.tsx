'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info, Package, Plus, Search, Target, Trash2, X } from 'lucide-react'
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
        backgroundColor: 'rgba(23, 23, 23, 0.4)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            background: 'var(--surface)',
            color: 'var(--text-main)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Kelola Produk Pengembangan & Fokus Penjualan
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Daftar SKU fokus yang diprioritaskan untuk pengawalan demo plot pasca penjualan oleh tim Sales
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Tutup"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Notifikasi feedback */}
        {msg && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              background: msg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {msg.type === 'success' ? <CheckCircle2 size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} /> : <AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />} {msg.text}
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
                background: 'var(--danger-bg)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}><AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '0.125rem' }} /> <span>{loadError} Perubahan dinonaktifkan sampai data berhasil dimuat.</span></span>
              <button
                type="button"
                onClick={loadData}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 500, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              opacity: canEdit ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Tambah Produk Fokus Baru
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Memuat produk...' : `Tersedia ${candidates.length} SKU Accurate`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  disabled={!canEdit}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    cursor: canEdit ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <FileSpreadsheet size={16} strokeWidth={1.75} /> Import Excel
                </button>
              </div>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <fieldset disabled={!canEdit || adding} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Kolom Pencarian Cepat SKU */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <Search size={14} strokeWidth={1.75} /> Cari SKU Accurate (Ketik kata kunci untuk memfilter dropdown)
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
                      fontSize: '0.875rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Tag Quick-Pick jika ada hasil pencarian spesifik */}
              {searchTerm.trim().length >= 2 && filteredCandidates.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Klik langsung untuk memilih ({filteredCandidates.length} hasil):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: '100px', overflowY: 'auto' }}>
                    {filteredCandidates.slice(0, 15).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleQuickPick(item)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-xs)',
                          border: selectedMasterId === item.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: selectedMasterId === item.id ? 'var(--primary)' : 'var(--surface)',
                          color: selectedMasterId === item.id ? '#ffffff' : 'var(--text-main)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
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
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      Pilih Dari Dropdown SKU Accurate
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      <span className="num">{filteredCandidates.length}</span> SKU tampil
                    </span>
                  </div>
                  <select
                    value={selectedMasterId}
                    onChange={handleSelectMaster}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
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
                      padding: '0.5rem 0.625rem',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  />
                </div>
              </div>

              {/* Input Komoditas & Catatan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Target Komoditas / Sasaran Hama (Opsional)
                  </label>
                  <input
                    type="text"
                    value={targetCrop}
                    onChange={(e) => setTargetCrop(e.target.value)}
                    placeholder="misal: Padi, Jagung, Bawang Merah, Wereng"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Catatan Sasaran (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="misal: Fokus Penjualan Nasional Q1 2026"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
                  <Info size={14} strokeWidth={1.75} className="icon-inline" /> Produk dari SKU Accurate dicocokkan ke invoice per <strong>kode SKU</strong> (satu ukuran kemasan).
                  Nama custom tanpa kode (mis. &quot;Pronate&quot;) dicocokkan per <strong>nama</strong> (semua ukuran).
                </span>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {!adding && <Plus size={16} strokeWidth={1.75} />}
                  {adding ? 'Menyimpan...' : 'Tambahkan ke Daftar Produk Fokus'}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
          )}

          {/* Daftar Produk Fokus Saat Ini */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h4 className="num" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Daftar Produk Pengembangan Terdaftar ({products.filter((p) => p.isActive).length} Aktif / {products.length} Total)
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Produk aktif langsung dianalisis oleh mesin Opportunity Finder
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Memuat daftar produk...
              </div>
            ) : loadError ? null : products.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <Package size={28} strokeWidth={1.5} style={{ marginBottom: '0.5rem', color: 'var(--text-light)' }} />
                <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Belum ada produk pengembangan yang didaftarkan.</div>
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
                      borderRadius: 'var(--radius-sm)',
                      background: prod.isActive ? 'var(--surface)' : 'var(--surface-2)',
                      border: '1px solid var(--border)',
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
                          background: prod.isActive ? 'var(--primary)' : '#d4d4d4',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'var(--transition)',
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
                            background: 'var(--surface)',
                            position: 'absolute',
                            top: '2px',
                            left: prod.isActive ? '18px' : '2px',
                            transition: 'left 0.2s',
                          }}
                        />
                      </button>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {prod.name}
                          </span>
                          {prod.code && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface-2)',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono-stack)',
                                fontWeight: 400,
                              }}
                            >
                              {prod.code}
                            </span>
                          )}
                          {!prod.code && (
                            <span
                              title="Tanpa kode SKU: dicocokkan ke invoice berdasarkan nama, mencakup semua ukuran kemasan"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--warning-bg)',
                                color: 'var(--warning)',
                                fontWeight: 500,
                              }}
                            >
                              cocok via nama
                            </span>
                          )}
                          {!prod.isActive && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface-3)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Nonaktif
                            </span>
                          )}
                        </div>
                        {(prod.targetCrop || prod.notes) && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            {prod.targetCrop && (
                              <span>
                                Komoditas: <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{prod.targetCrop}</strong>
                              </span>
                            )}
                            {prod.targetCrop && prod.notes && <span> • </span>}
                            {prod.notes && <span>{prod.notes}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(prod)}
                      disabled={busyId === prod.id}
                      title="Hapus produk"
                      aria-label="Hapus produk"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.375rem',
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
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
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Setiap perubahan langsung tersimpan & berlaku untuk semua akun
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
