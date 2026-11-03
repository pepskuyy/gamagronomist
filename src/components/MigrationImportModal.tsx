'use client'

import { AlertTriangle, ArrowLeft, Download, FolderOpen, Upload } from 'lucide-react'
import { useState, useRef } from 'react'

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

  async function downloadTemplate() {
    const XLSX = await import('xlsx') // lazy-load
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
    reader.onload = async (ev) => {
      try {
        const XLSX = await import('xlsx')
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

  const [importError, setImportError] = useState<string | null>(null)

  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null)

  async function handleImport() {
    setLoading(true)
    setImportError(null)
    setProgress({ current: 0, total: preview.length })

    try {
      const CHUNK_SIZE = 20
      let totalInserted = 0
      let totalSkipped = 0
      let allErrors: any[] = []

      for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
        const chunk = preview.slice(i, i + CHUNK_SIZE)
        const res = await onImport(chunk)
        
        totalInserted += res.inserted || 0
        totalSkipped += res.skipped || 0
        
        if (res.errors && Array.isArray(res.errors)) {
          // Correct the row number based on the chunk offset
          const correctedErrors = res.errors.map((e: any) => ({
            ...e,
            row: i + e.row // e.row is usually chunkIndex + 2
          }))
          allErrors = [...allErrors, ...correctedErrors]
        }
        
        setProgress({ current: Math.min(i + CHUNK_SIZE, preview.length), total: preview.length })
      }

      setResult({
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: allErrors
      })
      setStep('done')
      if (totalInserted > 0) onSuccess()
    } catch (err: any) {
      console.error('Import error:', err)
      setImportError(
        err?.message?.includes('timed out') || err?.message?.includes('FUNCTION_INVOCATION_TIMEOUT')
          ? 'Server timeout! Koneksi terputus saat memproses data. Silakan coba lagi.'
          : `Terjadi kesalahan saat import: ${err?.message || 'Unknown error'}. Silakan coba lagi.`
      )
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const th: React.CSSProperties = { padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%', maxWidth: step === 'preview' ? '90vw' : '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>

        {step === 'upload' && (
          <>
            <h3 style={{ marginBottom: '0.5rem' }}>Import {title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Upload file .xlsx dengan kolom: {columns.map(c => <><code key={c.key}>{c.label}</code>{c.required && <span style={{ color: 'var(--danger)' }}>*</span>} </> )}
            </p>

            <label style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '0.5rem', background: 'var(--surface-2)' }}>
              <FolderOpen size={32} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 500 }}>Klik untuk pilih file Excel</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>.xlsx atau .xls</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            </label>

            {fileError && <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>{fileError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={downloadTemplate} className="btn btn-outline" style={{ flex: 1 }}><Download size={16} strokeWidth={1.75} className="icon-inline" />Unduh Template</button>
              <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <h3 style={{ marginBottom: '0.5rem' }}>Preview Data (<span className="num">{preview.length}</span> baris)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Periksa data sebelum diimpor. Data duplikat akan otomatis dilewati.</p>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
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
                      <td className="num" style={{ ...td, color: 'var(--text-muted)' }}>{i + 2}</td>
                      {columns.map(c => (
                        <td key={c.key} style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[c.key] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger)' }}>
                {importError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setStep('upload'); setPreview([]); setImportError(null); if (fileRef.current) fileRef.current.value = '' }} disabled={loading} className="btn btn-outline" style={{ flex: 1 }}><ArrowLeft size={16} strokeWidth={1.75} className="icon-inline" />Ganti File</button>
              <button onClick={handleImport} disabled={loading} className="btn btn-primary" style={{ flex: 2, position: 'relative', overflow: 'hidden' }}>
                {loading && progress ? (
                  <>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'rgba(255,255,255,0.2)', width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.3s var(--ease)' }} />
                    <span className="num" style={{ position: 'relative', zIndex: 1 }}>Mengimpor {progress.current} / {progress.total}...</span>
                  </>
                ) : <><Upload size={16} strokeWidth={1.75} className="icon-inline" />{`Import ${preview.length} Data`}</>}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <h3 style={{ marginBottom: '0.75rem' }}>Hasil Import {title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Berhasil</div>
                <div className="num" style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-main)' }}>{result.inserted}</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Dilewati</div>
                <div className="num" style={{ fontSize: '1.75rem', fontWeight: 600, color: result.skipped > 0 ? 'var(--warning)' : 'var(--text-main)' }}>{result.skipped}</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}><AlertTriangle size={16} strokeWidth={1.75} className="icon-inline" style={{ color: 'var(--warning)' }} />Detail baris yang dilewati:</p>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {result.errors.map((e: any, i: number) => (
                    <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.82rem', background: 'var(--surface)' }}>
                      <strong style={{ fontWeight: 500 }}>Baris <span className="num">{e.row}</span>:</strong> {e.name} — <span style={{ color: 'var(--warning)' }}>{e.reason}</span>
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
