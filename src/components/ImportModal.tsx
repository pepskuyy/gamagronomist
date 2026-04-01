'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { bulkImportProducts, BulkProductRow, BulkImportResult } from '@/app/actions/bulk-import'

const VALID_UNITS = ['ml', 'gr', 'kg', 'liter', 'pcs', 'sachet', 'botol']

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const data = [
    ['id_db', 'id_produk', 'nama_produk', 'satuan', 'deskripsi'],
    ['(kosongkan jika baru)', 'P001', 'Pupuk Cair Bintang', 'ml', 'Pupuk cair serbaguna'],
    ['', 'P002', 'Pestisida Andalan', 'liter', 'Untuk hama wereng'],
    ['', 'P003', 'Granul Spesifik', 'gr', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Produk')
  XLSX.writeFile(wb, 'template_import_produk.xlsx')
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ImportModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]     = useState<BulkProductRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult]       = useState<BulkImportResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [step, setStep]           = useState<'upload' | 'preview' | 'done'>('upload')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (raw.length === 0) {
          setFileError('File kosong atau tidak memiliki data yang valid.')
          return
        }

        // Normalize keys (case-insensitive, trim)
        const rows: BulkProductRow[] = raw.map(r => {
          const keys = Object.keys(r).reduce((acc, k) => {
            acc[k.toLowerCase().replace(/\s+/g, '_')] = r[k]
            return acc
          }, {} as any)
          const rawId = String(keys['id_db'] ?? '').trim()
          return {
            id:          rawId && !rawId.startsWith('(') ? rawId : undefined,
            code:        String(keys['id_produk'] ?? keys['code'] ?? '').trim() || undefined,
            name:        String(keys['nama_produk'] ?? keys['name'] ?? '').trim(),
            unit:        String(keys['satuan'] ?? keys['unit'] ?? '').trim().toLowerCase(),
            description: String(keys['deskripsi'] ?? keys['description'] ?? '').trim() || undefined,
          }
        })

        if (rows.length === 0) {
          setFileError('Tidak ada baris data ditemukan.')
          return
        }

        setPreview(rows)
        setStep('preview')
      } catch (err: any) {
        setFileError('Gagal membaca file. Pastikan formatnya .xlsx atau .xls.')
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setLoading(true)
    const res = await bulkImportProducts(preview)
    setResult(res)
    setStep('done')
    setLoading(false)
    if (res.inserted > 0) onSuccess()
  }

  const th: React.CSSProperties = { padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: step === 'preview' ? '760px' : '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>

        {/* ─── Step 1: Upload ─── */}
        {step === 'upload' && (
          <>
            <h3 style={{ marginBottom: '0.25rem' }}>📥 Import / Update Produk dari Excel</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Upload file .xlsx atau .xls. Gunakan kolom <code>id_db</code> (isi ID dari sistem) untuk <strong>memperbarui</strong> produk yang sudah ada, atau kosongkan untuk <strong>menambah</strong> produk baru.</p>
            <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', fontSize: '0.82rem', color: '#166534' }}>
              💡 <strong>Tip:</strong> Gunakan tombol &quot;Export Excel&quot; di halaman produk untuk mendapatkan file dengan kolom <code>id_db</code> yang sudah terisi, lalu edit dan re-import kembali.
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#1e40af' }}>
              <strong>Satuan yang valid:</strong> {VALID_UNITS.join(', ')}
            </div>

            <label style={{ border: '2px dashed var(--border)', borderRadius: '0.75rem', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '0.5rem', background: 'var(--surface-hover)' }}>
              <span style={{ fontSize: '2.5rem' }}>📂</span>
              <span style={{ fontWeight: 600 }}>Klik untuk pilih file Excel</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>.xlsx atau .xls</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            </label>

            {fileError && <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.9rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '0.5rem', fontSize: '0.85rem' }}>{fileError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={downloadTemplate} className="btn btn-outline" style={{ flex: 1 }}>⬇️ Unduh Template</button>
              <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
            </div>
          </>
        )}

        {/* ─── Step 2: Preview ─── */}
        {step === 'preview' && (
          <>
            <h3 style={{ marginBottom: '0.25rem' }}>🔍 Preview Data ({preview.length} baris)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Pastikan data sudah benar sebelum diimpor. Produk duplikat akan dilewati otomatis.</p>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>ID Produk</th>
                    <th style={th}>Nama Produk</th>
                    <th style={th}>Satuan</th>
                    <th style={th}>Deskripsi</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const nameOk = !!row.name
                    const unitOk = VALID_UNITS.includes(row.unit)
                    const ok = nameOk && unitOk
                    return (
                      <tr key={i} style={{ background: ok ? 'transparent' : '#fff7ed' }}>
                        <td style={td}>{i + 2}</td>
                        <td style={{ ...td, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.code || '—'}</td>
                        <td style={td}><strong>{row.name || <em style={{ color: '#9ca3af' }}>kosong</em>}</strong></td>
                        <td style={td}>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, background: unitOk ? '#dcfce7' : '#fee2e2', color: unitOk ? '#166534' : '#b91c1c' }}>
                            {row.unit || '—'}
                          </span>
                        </td>
                        <td style={{ ...td, color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                        <td style={td}>
                          {ok
                            ? <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}>✓ Siap</span>
                            : <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.8rem' }}>✗ Ada masalah</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setStep('upload'); setPreview([]); if (fileRef.current) fileRef.current.value = '' }} className="btn btn-outline" style={{ flex: 1 }}>← Ganti File</button>
              <button onClick={handleImport} disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                {loading ? '⏳ Sedang Mengimpor...' : `✅ Import ${preview.length} Produk`}
              </button>
            </div>
          </>
        )}

        {/* ─── Step 3: Result ─── */}
        {step === 'done' && result && (
          <>
            <h3 style={{ marginBottom: '0.75rem' }}>🎉 Hasil Import</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a' }}>{result.inserted}</div>
                <div style={{ fontSize: '0.85rem', color: '#166534' }}>Ditambahkan</div>
              </div>
              <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb' }}>{(result as any).updated ?? 0}</div>
                <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>Diperbarui</div>
              </div>
              <div style={{ padding: '1rem', background: result.skipped > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: result.skipped > 0 ? '#ea580c' : '#16a34a' }}>{result.skipped}</div>
                <div style={{ fontSize: '0.85rem', color: result.skipped > 0 ? '#9a3412' : '#166534' }}>Dilewati</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>⚠️ Detail baris yang dilewati:</p>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #fde68a', borderRadius: '0.5rem' }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #fde68a', fontSize: '0.82rem', background: '#fffbeb' }}>
                      <strong>Baris {e.row}:</strong> {e.name} — <span style={{ color: '#92400e' }}>{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>Selesai &amp; Tutup</button>
          </>
        )}
      </div>
    </div>
  )
}
