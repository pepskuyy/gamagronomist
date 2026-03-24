'use client'

import { useState } from 'react'
import Link from 'next/link'
import MigrationImportModal from '@/components/MigrationImportModal'
import {
  bulkImportAreas, AreaRow,
  bulkImportCustomerBehaviors, CBRow,
  bulkImportDemoPlots, DemoPlotRow
} from '@/app/actions/migration'

type ImportCategory = {
  id: string
  icon: string
  title: string
  description: string
  order: number
  columns: { key: string; label: string; required?: boolean }[]
  importFn: (rows: any[]) => Promise<any>
}

const categories: ImportCategory[] = [
  {
    id: 'area', icon: '🌏', title: 'Area', description: 'Import daftar area/wilayah kerja.', order: 1,
    columns: [{ key: 'name', label: 'nama_area', required: true }],
    importFn: (rows) => bulkImportAreas(rows as AreaRow[])
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
    importFn: async (rows) => {
      const res = await fetch('/api/migration/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import gagal')
      return data
    }
  },
  {
    id: 'cb', icon: '📝', title: 'Customer Behavior', description: 'Import data CB. Pastikan User sudah di-import terlebih dahulu. Data petani akan otomatis dibuat dari CB. Kolom komoditas dan produk_preferensi dipisah koma.', order: 3,
    columns: [
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
    importFn: (rows) => bulkImportCustomerBehaviors(rows as CBRow[])
  },
  {
    id: 'demoplot', icon: '🌱', title: 'Demo Plot', description: 'Import data demo plot. Petani dari CB sudah otomatis tersedia. Sertakan lat/long agar muncul di peta.', order: 4,
    columns: [
      { key: 'date', label: 'tanggal', required: true },
      { key: 'area', label: 'area' },
      { key: 'commodity', label: 'komoditas' },
      { key: 'landSize', label: 'luas_lahan' },
      { key: 'resultNotes', label: 'catatan_hasil' },
      { key: 'farmerName', label: 'nama_petani' },
      { key: 'isFinalSession', label: 'sesi_terakhir' },
      { key: 'latitude', label: 'latitude' },
      { key: 'longitude', label: 'longitude' },
      { key: 'username_fo', label: 'username_fo', required: true },
    ],
    importFn: (rows) => bulkImportDemoPlots(rows as DemoPlotRow[])
  },
]

export default function MigrationHubPage() {
  const [activeImport, setActiveImport] = useState<ImportCategory | null>(null)

  return (
    <div>
      {activeImport && (
        <MigrationImportModal
          title={activeImport.title}
          columns={activeImport.columns}
          onImport={activeImport.importFn}
          onClose={() => setActiveImport(null)}
          onSuccess={() => {}}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard/master" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Master Data</Link>
        <h2 style={{ margin: 0 }}>📦 Migrasi Data dari Spreadsheet</h2>
      </div>

      <div style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', marginBottom: '2rem', fontSize: '0.875rem', color: '#1e40af' }}>
        <strong>⚠️ Penting — Urutan Import:</strong> Lakukan import secara berurutan: <strong>Area → User → Customer Behavior → Demo Plot</strong>. Data petani akan otomatis dibuat dari data CB.
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
            <button onClick={() => setActiveImport(cat)} className="btn btn-primary" style={{ width: '100%' }}>
              📥 Import {cat.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
