'use client'

import { useMemo, useRef, useState } from 'react'
import { normalizeProductName } from '@/lib/product-name'
import { ArrowLeft, Check, Download, FileSpreadsheet, FolderOpen, Search } from 'lucide-react'

export interface ImportCandidate {
  name: string
  code?: string | null
}

interface ImportRow {
  code?: string
  name?: string
  targetCrop?: string
  notes?: string
  isActive?: boolean
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: { row: number; name: string; reason: string }[]
}

interface Props {
  candidates: ImportCandidate[]
  existingNames: string[]
  onCancel: () => void
  onImported: () => void
}

const MAX_ROWS = 1000

function parseActive(v: unknown): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return undefined
  if (['ya', 'y', 'yes', 'true', '1', 'aktif'].includes(s)) return true
  if (['tidak', 't', 'no', 'n', 'false', '0', 'nonaktif', 'non aktif'].includes(s)) return false
  return undefined
}

async function downloadTemplate(candidates: ImportCandidate[]) {
  // Lazy-load xlsx (~400KB) hanya saat dibutuhkan
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const data = [
    ['kode_sku', 'nama_produk', 'target_komoditas', 'catatan', 'aktif'],
    ['IK-150', '', 'Padi', 'Fokus Q1 2026', 'Ya'],
    ['', 'Biogent 50 SC', 'Bawang Merah', '', 'Ya'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 30 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Produk Fokus')

  // Sheet referensi: daftar SKU Accurate yang bisa dicocokkan dengan invoice
  const ref = XLSX.utils.aoa_to_sheet([
    ['kode_sku', 'nama_produk'],
    ...candidates.map((c) => [c.code || '', c.name]),
  ])
  ref['!cols'] = [{ wch: 14 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ref, 'Referensi SKU Accurate')

  XLSX.writeFile(wb, 'template_import_produk_fokus.xlsx')
}

export default function DevelopmentProductImport({ candidates, existingNames, onCancel, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const lookup = useMemo(() => {
    const byCode = new Map<string, string>()
    const byName = new Map<string, string>()
    for (const c of candidates) {
      if (c.code) byCode.set(c.code.toLowerCase(), c.name)
      byName.set(normalizeProductName(c.name), c.name)
    }
    return { byCode, byName, keys: Array.from(byName.keys()) }
  }, [candidates])

  const existing = useMemo(() => new Set(existingNames.map(normalizeProductName)), [existingNames])

  // Status tiap baris untuk preview
  const preview = useMemo(() => rows.map((r) => {
    const codeName = r.code ? lookup.byCode.get(r.code.toLowerCase()) : undefined
    const name = r.name || codeName || ''
    const key = normalizeProductName(name)

    if (!name) {
      return { ...r, resolvedName: '', ok: false, match: r.code ? 'Kode SKU tidak ditemukan' : 'Nama & kode kosong', isUpdate: false }
    }
    let match: string
    if (codeName || lookup.byName.has(key)) {
      match = '✓ SKU Accurate'
    } else {
      const partial = key.length >= 4 ? lookup.keys.filter((k) => k.includes(key)).length : 0
      match = partial > 0 ? `≈ Cocok ke ${partial} SKU` : '⚠ Tidak ada di SKU Accurate'
    }
    return { ...r, resolvedName: name, ok: true, match, isUpdate: existing.has(key) }
  }), [rows, lookup, existing])

  const validCount = preview.filter((p) => p.ok).length

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const parsed: ImportRow[] = raw.map((r) => {
          const k = Object.keys(r).reduce((acc, key) => {
            acc[key.toLowerCase().trim().replace(/\s+/g, '_')] = r[key]
            return acc
          }, {} as Record<string, any>)
          const str = (v: unknown) => String(v ?? '').trim() || undefined
          return {
            code: str(k['kode_sku'] ?? k['kode'] ?? k['sku'] ?? k['code']),
            name: str(k['nama_produk'] ?? k['nama'] ?? k['name']),
            targetCrop: str(k['target_komoditas'] ?? k['komoditas']),
            notes: str(k['catatan'] ?? k['notes']),
            isActive: parseActive(k['aktif'] ?? k['status']),
          }
        }).filter((r) => r.code || r.name || r.targetCrop || r.notes)

        if (parsed.length === 0) {
          setFileError('File kosong atau kolom tidak dikenali. Gunakan template yang disediakan.')
          return
        }
        if (parsed.length > MAX_ROWS) {
          setFileError(`Maksimal ${MAX_ROWS} baris per import (file berisi ${parsed.length} baris).`)
          return
        }
        setRows(parsed)
        setStep('preview')
      } catch {
        setFileError('Gagal membaca file. Pastikan formatnya .xlsx atau .xls.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    setLoading(true)
    setFileError(null)
    try {
      const res = await fetch('/api/demoplot-impact/development-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: rows, rowOffset: 2 }), // baris 1 = header Excel
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengimpor.')
      setResult(data)
      setStep('done')
      if (data.inserted > 0 || data.updated > 0) onImported()
    } catch (err: any) {
      setFileError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const th: React.CSSProperties = { padding: '0.5rem 0.625rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '0.5rem 0.625rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)' }
  const btn: React.CSSProperties = { padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }
  const btnPrimary: React.CSSProperties = { ...btn, border: '1px solid var(--primary)', background: 'var(--primary)', color: '#ffffff', fontWeight: 500 }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
      {step === 'upload' && (
        <>
          <h4 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileSpreadsheet size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Import Produk Fokus dari Excel</h4>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Isi <code>kode_sku</code> (SKU Accurate) <strong>atau</strong> <code>nama_produk</code>. Jika hanya kode yang diisi, nama diambil otomatis dari SKU Accurate.
            Produk yang sudah terdaftar akan <strong>diperbarui</strong>; kolom kosong tidak menimpa data lama. Kolom <code>aktif</code>: Ya / Tidak.
            Produk ber-kode dicocokkan ke invoice per kode SKU (satu ukuran kemasan); nama tanpa kode dicocokkan per nama (semua ukuran).
          </p>

          <label style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', background: 'var(--surface)' }}>
            <FolderOpen size={28} strokeWidth={1.5} style={{ color: 'var(--text-light)' }} />
            <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-main)' }}>Klik untuk pilih file Excel</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>.xlsx atau .xls — maksimal {MAX_ROWS} baris</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </label>

          {fileError && <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>{fileError}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => downloadTemplate(candidates)} style={btn}><Download size={16} strokeWidth={1.75} /> Unduh Template</button>
            <button type="button" onClick={onCancel} style={btn}>Batal</button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <h4 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> Preview Import (<span className="num">{rows.length}</span> baris)</h4>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Kolom <strong>Kecocokan</strong> menunjukkan apakah nama produk ditemukan di SKU Accurate. Produk bertanda ⚠ tetap bisa diimpor,
            tetapi kemungkinan tidak akan cocok dengan invoice sehingga tidak berpengaruh ke skoring.
          </p>

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', background: 'var(--surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ ...th, width: 44 }}>Baris</th>
                  <th style={th}>Kode</th>
                  <th style={th}>Nama Produk</th>
                  <th style={th}>Komoditas</th>
                  <th style={th}>Aktif</th>
                  <th style={th}>Kecocokan</th>
                  <th style={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} style={{ background: p.ok ? 'transparent' : 'var(--warning-bg)' }}>
                    <td className="num" style={{ ...td, color: 'var(--text-muted)' }}>{i + 2}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono-stack)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.code || '—'}</td>
                    <td style={td}><strong style={{ fontWeight: 500 }}>{p.resolvedName || <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>kosong</span>}</strong></td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{p.targetCrop || '—'}</td>
                    <td style={td}>{p.isActive === false ? 'Tidak' : p.isActive === true ? 'Ya' : '—'}</td>
                    <td style={{ ...td, fontSize: '0.75rem', fontWeight: 500, color: !p.ok ? 'var(--danger)' : p.match.startsWith('✓') ? 'var(--success)' : p.match.startsWith('≈') ? 'var(--info)' : 'var(--warning)' }}>{p.match}</td>
                    <td style={{ ...td, fontSize: '0.75rem' }}>{!p.ok ? 'Dilewati' : p.isUpdate ? 'Perbarui' : 'Baru'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fileError && <div style={{ marginBottom: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>{fileError}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setStep('upload'); setRows([]); if (fileRef.current) fileRef.current.value = '' }} style={btn}><ArrowLeft size={16} strokeWidth={1.75} /> Ganti File</button>
            <button type="button" onClick={handleImport} disabled={loading || validCount === 0} style={{ ...btnPrimary, opacity: loading || validCount === 0 ? 0.6 : 1 }}>
              {!loading && <Check size={16} strokeWidth={1.75} />}
              {loading ? 'Mengimpor...' : `Import ${validCount} Produk`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>Hasil Import</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Ditambahkan', value: result.inserted, bg: 'var(--success-bg)', color: 'var(--success)' },
              { label: 'Diperbarui', value: result.updated, bg: 'var(--info-bg)', color: 'var(--info)' },
              { label: 'Dilewati', value: result.skipped, bg: result.skipped > 0 ? 'var(--warning-bg)' : 'var(--surface)', color: result.skipped > 0 ? 'var(--warning)' : 'var(--text-muted)' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '0.75rem', background: s.bg, borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div className="num" style={{ fontSize: '1.5rem', fontWeight: 600, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.78rem', background: 'var(--warning-bg)' }}>
                  <strong style={{ fontWeight: 500 }}>Baris {e.row}:</strong> {e.name} — <span style={{ color: 'var(--warning)' }}>{e.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} style={btnPrimary}>Selesai</button>
          </div>
        </>
      )}
    </div>
  )
}
