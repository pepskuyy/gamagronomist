'use client'

import { useState } from 'react'
import Link from 'next/link'
import MigrationImportModal from '@/components/MigrationImportModal'

type ImportCategory = {
  id: string
  icon: string
  title: string
  description: string
  order: number
  columns: { key: string; label: string; required?: boolean }[]
  apiPath: string
  supportsRepair?: boolean
}

const categories: ImportCategory[] = [
  {
    id: 'area', icon: '🌏', title: 'Area', description: 'Import daftar area/wilayah kerja.', order: 1,
    columns: [{ key: 'name', label: 'nama_area', required: true }],
    apiPath: '/api/migration/area',
  },
  {
    id: 'user', icon: '👤', title: 'User (SPV/AFA/FO/INTERN)', description: 'Import akun pengguna. Pastikan Area sudah di-import terlebih dahulu. Role yang valid: ADMIN, SPV, AFA, FO, INTERN.', order: 2,
    columns: [
      { key: 'username', label: 'username', required: true },
      { key: 'password', label: 'password', required: true },
      { key: 'name', label: 'nama', required: true },
      { key: 'role', label: 'role', required: true },
      { key: 'areaName', label: 'nama_area' },
      { key: 'afaName', label: 'nama_afa' },
      { key: 'status', label: 'status' },
    ],
    apiPath: '/api/migration/users',
  },
  {
    id: 'cb', icon: '📝', title: 'Customer Behavior', description: 'Import data CB. Pastikan User sudah di-import terlebih dahulu. Data petani akan otomatis dibuat dari CB. Kolom komoditas dan produk_preferensi dipisah koma.', order: 3,
    columns: [
      { key: 'tanggal', label: 'tanggal', required: true },
      { key: 'username', label: 'username_pelapor', required: true },
      { key: 'farmerName', label: 'nama_petani', required: true },
      { key: 'age', label: 'umur' },
      { key: 'phone', label: 'telepon' },
      { key: 'kabupaten', label: 'kabupaten' },
      { key: 'kecamatan', label: 'kecamatan' },
      { key: 'desa', label: 'desa' },
      { key: 'commodity', label: 'komoditas' },
      { key: 'reasonChoice', label: 'alasan_pilih' },
      { key: 'constraints', label: 'kendala' },
      { key: 'optTypes', label: 'jenis_opt' },
      { key: 'optDetails', label: 'detail_opt' },
      { key: 'usedProducts', label: 'produk_preferensi' },
      { key: 'buyLocation', label: 'lokasi_beli' },
      { key: 'buyReason', label: 'alasan_beli' },
      { key: 'references', label: 'referensi' },
      { key: 'notes', label: 'catatan' },
    ],
    apiPath: '/api/migration/cb',
  },
  {
    id: 'demoplot', icon: '🌱', title: 'Demo Plot', description: 'Import data demo plot. Kolom produk diisi nama produk dipisah koma (misal: "Bion-M:100,Virtako:50"). Jika tanpa jumlah, defaultnya 1. Nama produk harus sesuai dengan nama di Master Produk.', order: 4,
    columns: [
      { key: 'date', label: 'tanggal', required: true },
      { key: 'username_fo', label: 'username_fo', required: true },
      { key: 'area', label: 'area' },
      { key: 'commodity', label: 'komoditas' },
      { key: 'farmerName', label: 'nama_petani' },
      { key: 'landSize', label: 'luas_lahan' },
      { key: 'produk', label: 'produk' },
      { key: 'resultNotes', label: 'catatan_hasil' },
      { key: 'isFinalSession', label: 'sesi_terakhir' },
      { key: 'latitude', label: 'latitude' },
      { key: 'longitude', label: 'longitude' },
    ],
    apiPath: '/api/migration/demoplot',
    supportsRepair: true,
  },
  {
    id: 'spot-demoplot', icon: '🎯', title: 'Spot Demo Plot', description: 'Import data Spot Demo Plot. Kolom produk diisi nama produk dipisah koma (misal: "Bion-M:100,Virtako:50").', order: 5,
    columns: [
      { key: 'date', label: 'tanggal', required: true },
      { key: 'username_fo', label: 'username_fo', required: true },
      { key: 'kabupaten', label: 'kabupaten' },
      { key: 'kecamatan', label: 'kecamatan' },
      { key: 'desa', label: 'desa' },
      { key: 'weeds', label: 'gulma' },
      { key: 'produk', label: 'produk' },
      { key: 'observationResult', label: 'hasil_observasi' },
      { key: 'latitude', label: 'latitude' },
      { key: 'longitude', label: 'longitude' },
    ],
    apiPath: '/api/migration/spot-demoplot',
    supportsRepair: true,
  },
]

export default function MigrationHubPage() {
  const [activeImport, setActiveImport] = useState<ImportCategory | null>(null)
  const [repairMode, setRepairMode] = useState(false)

  async function handleImport(apiPath: string, rows: any[]) {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, repairMode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Import gagal')
    return data
  }

  return (
    <div>
      {activeImport && (
        <MigrationImportModal
          title={repairMode ? `🔧 Repair Produk — ${activeImport.title}` : activeImport.title}
          columns={activeImport.columns}
          onImport={(rows) => handleImport(activeImport.apiPath, rows)}
          onClose={() => { setActiveImport(null); setRepairMode(false) }}
          onSuccess={() => {}}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
        <h2 style={{ margin: 0 }}>📦 Migrasi Data dari Spreadsheet</h2>
      </div>

      <div style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', marginBottom: '2rem', fontSize: '0.875rem', color: '#1e40af' }}>
        <strong>⚠️ Penting — Urutan Import:</strong> Lakukan import secara berurutan: <strong>Area → User → Customer Behavior → Demo Plot → Spot Demo Plot</strong>. Data petani akan otomatis dibuat dari data CB.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {categories.sort((a, b) => a.order - b.order).map(cat => (
          <div key={cat.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.8rem' }}>{cat.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{cat.order}. {cat.title}</h3>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{cat.description}</p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <strong>Kolom:</strong> {cat.columns.map(c => c.label).join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setRepairMode(false); setActiveImport(cat) }} className="btn btn-primary" style={{ flex: 1 }}>
                📥 Import {cat.title}
              </button>
              {cat.supportsRepair && (
                <button onClick={() => { setRepairMode(true); setActiveImport(cat) }} className="btn btn-outline" style={{ flex: 0, whiteSpace: 'nowrap', fontSize: '0.8rem' }} title="Upload ulang file yang sama untuk memperbaiki data produk yang hilang pada data migrasi sebelumnya">
                  🔧 Repair
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
