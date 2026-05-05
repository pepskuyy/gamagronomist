'use client'

/**
 * ImageUploader — versi yang mendukung mode offline.
 * 
 * - Online: langsung upload ke Cloudinary, kembalikan URL.
 * - Offline: simpan Blob di state lokal, tampilkan preview via createObjectURL.
 *   Blob akan diupload oleh Service Worker saat sinyal pulih.
 * 
 * Props:
 * - onUploadSuccess(urls: string[]) — dipanggil saat mode online, berisi Cloudinary URLs
 * - onOfflineFiles(blobs: PhotoBlob[]) — dipanggil saat mode offline, berisi Blob data
 * - isOfflineMode: boolean — kontrolkan dari parent (berdasarkan navigator.onLine)
 */

import { useState, useEffect } from 'react'
import type { PhotoBlob } from '@/lib/offline-db'

interface ImageUploaderProps {
  onUploadSuccess: (urls: string[]) => void
  onOfflineFiles?: (blobs: PhotoBlob[]) => void
  isOfflineMode?: boolean
  label?: string
  maxFiles?: number
}

interface LocalPhoto {
  src: string         // URL untuk preview (bisa Cloudinary URL atau createObjectURL)
  blob?: Blob         // Hanya ada di offline mode
  filename?: string
  mimeType?: string
  isOffline: boolean  // Tanda apakah ini blob lokal atau sudah di-upload
}

export default function ImageUploader({
  onUploadSuccess,
  onOfflineFiles,
  isOfflineMode = false,
  label = 'Dokumentasi (Upload Foto)',
  maxFiles = 3,
}: ImageUploaderProps) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sinkronisasi ke parent setiap kali photos berubah
  useEffect(() => {
    const urls = photos.filter(p => !p.isOffline).map(p => p.src)
    onUploadSuccess(urls)

    if (onOfflineFiles) {
      const blobs: PhotoBlob[] = photos
        .filter(p => p.isOffline && p.blob)
        .map(p => ({
          blob: p.blob!,
          filename: p.filename || 'photo.jpg',
          mimeType: p.mimeType || 'image/jpeg',
          previewUrl: p.src,
        }))
      onOfflineFiles(blobs)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos])

  // Cleanup object URLs saat unmount agar tidak memory leak
  useEffect(() => {
    return () => {
      photos.forEach(p => {
        if (p.isOffline && p.src.startsWith('blob:')) {
          URL.revokeObjectURL(p.src)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (photos.length + files.length > maxFiles) {
      setError(`Maksimal ${maxFiles} foto diizinkan.`)
      e.target.value = ''
      return
    }

    setError(null)
    const newPhotos: LocalPhoto[] = []

    if (isOfflineMode) {
      // ── OFFLINE MODE: simpan blob lokal ─────────────────────────
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const previewUrl = URL.createObjectURL(file)
        newPhotos.push({
          src: previewUrl,
          blob: file,
          filename: file.name,
          mimeType: file.type,
          isOffline: true,
        })
      }
      setPhotos(prev => [...prev, ...newPhotos])
    } else {
      // ── ONLINE MODE: upload ke Cloudinary ───────────────────────
      setUploading(true)
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fd = new FormData()
        fd.append('file', file)
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: fd })

          // Safe JSON parse — server bisa mengembalikan HTML/text error
          let data: any = {}
          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            data = await res.json()
          } else {
            const text = await res.text()
            throw new Error(`Upload gagal (${res.status}): ${text.slice(0, 120)}`)
          }

          if (!res.ok) throw new Error(data.error || `Gagal upload (${res.status})`)
          newPhotos.push({ src: data.url, isOffline: false })
        } catch (err: any) {
          setError(err.message || 'Gagal mengunggah foto. Coba lagi.')
        }
      }
      setPhotos(prev => [...prev, ...newPhotos])
      setUploading(false)
    }

    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => {
      const removed = prev[idx]
      if (removed.isOffline && removed.src.startsWith('blob:')) {
        URL.revokeObjectURL(removed.src)
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  return (
    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
      <label className="form-label">
        {label} {photos.length}/{maxFiles}
        {isOfflineMode && (
          <span style={{
            marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
            background: '#fef3c7', color: '#92400e',
            padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #fde68a'
          }}>
            📵 Tersimpan Lokal
          </span>
        )}
      </label>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}

      {isOfflineMode && (
        <div style={{
          fontSize: '0.8rem', color: '#92400e', background: '#fffbeb',
          border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem'
        }}>
          📵 Mode Offline — Foto akan tersimpan di perangkat dan otomatis diupload saat sinyal tersedia.
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {photos.map((photo, idx) => (
          <div key={idx} style={{
            position: 'relative', width: '100px', height: '100px',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
            border: photo.isOffline ? '2px solid #f59e0b' : '1px solid var(--border)'
          }}>
            <img src={photo.src} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {photo.isOffline && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(245,158,11,0.85)', color: 'white',
                fontSize: '9px', textAlign: 'center', padding: '2px'
              }}>
                📵 LOKAL
              </div>
            )}
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                background: 'rgba(255,0,0,0.8)', color: 'white',
                border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '10px'
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {photos.length < maxFiles && (
          <label style={{
            width: '100px', height: '100px',
            borderRadius: 'var(--radius-md)',
            border: `2px dashed ${isOfflineMode ? '#f59e0b' : 'var(--border)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: isOfflineMode ? '#fffbeb' : 'var(--surface-hover)',
            color: isOfflineMode ? '#92400e' : 'var(--text-muted)',
            fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem'
          }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>
              {isOfflineMode ? '📸' : '+'}
            </span>
            {uploading ? 'Uploading...' : isOfflineMode ? 'Ambil Foto' : 'Tambah'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
        {isOfflineMode
          ? 'Foto diambil dari kamera dan disimpan lokal — akan otomatis diunggah saat sinyal tersedia.'
          : 'Format: JPG, PNG. Rekomendasi rasio 4:3 atau 16:9.'}
      </p>
    </div>
  )
}
