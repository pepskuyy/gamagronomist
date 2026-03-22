'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

type ColumnDef = { key: string; label: string; required?: boolean }

interface Props {
  title: string
  columns: ColumnDef[]
  onImport: (rows: any[]) => Promise<{ success?: boolean; inserted: number; skipped: number; errors: { row: number; name: string; reason: string }[] }>
  onClose: () => void
  onSuccess: () => void
}

export default function MigrationImportModal({ title, columns, onImport, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const header = columns.map(c => c.label)
    const example = columns.map(() => '')
    const ws = XLSX.utils.aoa_to_sheet([header, example])
    ws['!cols'] = columns.map(() => ({ wch: 22 }))
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `template_${title.toLowerCase().replace(/\s+/g, '_')}.xlsx`)
  }

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
        if (raw.length === 0) { setFileError('File kosong.'); return }

        const rows = raw.map(r => {
          const keys = Object.keys(r).reduce((acc, k) => {
            acc[k.toLowerCase().replace(/\s+/g, '_')] = r[k]
            return acc
          }, {} as any)

          const mapped: any = {}
          columns.forEach(col => {
            mapped[col.key] = String(keys[col.label.toLowerCase().replace(/\s+/g, '_')] ?? keys[col.key] ?? '').trim()
          })
          return mapped
        })

        setPreview(rows)
        setStep('preview')
      } catch { setFileError('Gagal membaca file.') }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setLoading(true)
    const res = await onImport(preview)
    setResult(res)
    setStep('done')
    setLoading(false)
    if (res.inserted > 0) onSuccess()
  }

  const th: React.CSSProperties = { padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: step === 'preview' ? '90vw' : '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>

        {step === 'upload' && (
          <>
            <h3 style={{ marginBottom: '0.5rem' }}>📥 Import {title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Upload file .xlsx dengan kolom: {columns.map(c => <><code key={c.key}>{c.label}</code>{c.required && <span style={{ color: 'red' }}>*</span>} </> )}
            </p>

            <label style={{ border: '2px dashed var(--border)', borderRadius: '0.75rem', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '0.5rem', background: 'var(--surface-hover)' }}>
              <span style={{ fontSize: '2.5rem' }}>📂</span>
              <span style={{ fontWeight: 600 }}>Klik untuk pilih file Excel</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>.xlsx atau .xls</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            </label>

            {fileError && <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '0.5rem', fontSize: '0.85rem' }}>{fileError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={downloadTemplate} className="btn btn-outline" style={{ flex: 1 }}>⬇️ Unduh Template</button>
              <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <h3 style={{ marginBottom: '0.5rem' }}>🔍 Preview Data ({preview.length} baris)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Periksa data sebelum diimpor. Data duplikat akan otomatis dilewati.</p>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    {columns.map(c => <th key={c.key} style={th}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td style={td}>{i + 2}</td>
                      {columns.map(c => (
                        <td key={c.key} style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[c.key] || <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setStep('upload'); setPreview([]); if (fileRef.current) fileRef.current.value = '' }} className="btn btn-outline" style={{ flex: 1 }}>← Ganti File</button>
              <button onClick={handleImport} disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                {loading ? '⏳ Sedang Mengimpor...' : `✅ Import ${preview.length} Data`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <h3 style={{ marginBottom: '0.75rem' }}>🎉 Hasil Import {title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a' }}>{result.inserted}</div>
                <div style={{ fontSize: '0.85rem', color: '#166534' }}>Berhasil</div>
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
                  {result.errors.map((e: any, i: number) => (
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
