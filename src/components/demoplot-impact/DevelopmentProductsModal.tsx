'use client'

import { useState, useEffect, useMemo } from 'react'

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
  source?: 'master' | 'sales_invoice'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function DevelopmentProductsModal({ isOpen, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<DevelopmentProduct[]>([])
  const [candidates, setCandidates] = useState<CandidateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form input tambah produk baru
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [customName, setCustomName] = useState('')
  const [targetCrop, setTargetCrop] = useState('')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Load data produk pengembangan & master kandidat produk
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setMsg(null)
    setSearchTerm('')

    fetch('/api/demoplot-impact/development-products')
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat produk pengembangan.')
        return r.json()
      })
      .then((data) => {
        if (data.products) setProducts(data.products)
        if (data.candidates && Array.isArray(data.candidates)) {
          setCandidates(data.candidates)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error loading dev products:', err)
        setLoading(false)
      })
  }, [isOpen])

  // Filter kandidat master produk berdasarkan pencarian live
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

  // Tambahkan ke list produk pengembangan
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const nameToAdd = customName.trim()
    if (!nameToAdd) {
      setMsg({ type: 'error', text: 'Nama produk tidak boleh kosong.' })
      return
    }

    // Cek duplikasi
    const exists = products.some(
      (p) => p.name.toLowerCase() === nameToAdd.toLowerCase()
    )
    if (exists) {
      setMsg({ type: 'error', text: `Produk "${nameToAdd}" sudah terdaftar dalam daftar.` })
      return
    }

    const matchedMaster = candidates.find((m) => m.id === selectedMasterId)

    const newProd: DevelopmentProduct = {
      id: selectedMasterId || `custom_${Date.now()}`,
      name: nameToAdd,
      code: matchedMaster?.code || null,
      targetCrop: targetCrop.trim() || null,
      notes: notes.trim() || null,
      isActive: true,
    }

    setProducts([newProd, ...products])
    setSelectedMasterId('')
    setCustomName('')
    setTargetCrop('')
    setNotes('')
    setSearchTerm('')
    setMsg({ type: 'success', text: `Produk "${nameToAdd}" berhasil ditambahkan ke daftar.` })
  }

  // Toggle status aktif
  const handleToggleActive = (idx: number) => {
    const copy = [...products]
    copy[idx].isActive = !copy[idx].isActive
    setProducts(copy)
  }

  // Hapus produk dari list
  const handleDelete = (idx: number) => {
    const prod = products[idx]
    if (!confirm(`Hapus produk "${prod.name}" dari list produk pengembangan?`)) return
    const copy = [...products]
    copy.splice(idx, 1)
    setProducts(copy)
  }

  // Simpan ke database
  const handleSaveAll = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/demoplot-impact/development-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.')

      setMsg({ type: 'success', text: 'Daftar produk pengembangan berhasil disimpan!' })
      setSaving(false)
      onSaved()
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
      setSaving(false)
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
      onClick={onClose}
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
            onClick={onClose}
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
          {/* Form Tambah Produk */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1.1rem 1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                ➕ Tambah Produk Fokus Baru
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {candidates.length > 0 ? `Tersedia ${candidates.length} master SKU produk` : 'Memuat produk...'}
              </span>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Kolom Pencarian Cepat Master SKU */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                  🔍 Cari Master SKU Produk (Ketik kata kunci untuk memfilter dropdown)
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

              {/* Dropdown Select Master SKU & Input Nama */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                      Pilih Dari Dropdown Master SKU
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
                    <option value="">-- Pilih dari Master Produk ({filteredCandidates.length} SKU) --</option>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
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
                  ➕ Masukkan ke Daftar Produk Fokus
                </button>
              </div>
            </form>
          </div>

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
            ) : products.length === 0 ? (
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
                  Gunakan form di atas untuk memilih dan mendaftarkan produk prioritas penjualan Gama Agro.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {products.map((prod, idx) => (
                  <div
                    key={prod.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: prod.isActive ? '#ffffff' : '#f1f5f9',
                      border: `1px solid ${prod.isActive ? '#cbd5e1' : '#e2e8f0'}`,
                      opacity: prod.isActive ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(idx)}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                      onClick={() => handleDelete(idx)}
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
            Data tersimpan secara global di sistem Gama Agronomist
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '0.375rem',
                border: 'none',
                background: '#16a34a',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {saving ? 'Menyimpan...' : '💾 Simpan Konfigurasi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
