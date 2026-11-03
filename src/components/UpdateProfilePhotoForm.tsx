'use client'

import { useState, useTransition } from 'react'
import { updateProfilePhoto } from '@/app/actions/auth'
import ImageUploader from '@/components/ImageUploader'

export default function UpdateProfilePhotoForm({ currentPhoto }: { currentPhoto: string | null }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhoto)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function handleSave() {
    setError(null)
    setSuccess(null)
    start(async () => {
      const res = await updateProfilePhoto(photoUrl)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess('Foto profil berhasil diperbarui.')
        // Reload page to reflect changes in sidebar
        window.location.reload()
      }
    })
  }

  function handleUploadSuccess(urls: string[]) {
    // We only expect max 1 file
    if (urls.length > 0) {
      setPhotoUrl(urls[0])
    } else {
      setPhotoUrl(null)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--success-bg)', color: 'var(--success)', fontSize: '0.875rem' }}>{success}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ 
          width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-2)', 
          border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Tidak ada
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          {/* Note: ImageUploader currently doesn't accept initialUrls in its props, 
              so it manages its own internal state for NEW uploads. 
              We'll use it to grab the new URL, but we also have a "Hapus Foto" button. */}
          <ImageUploader 
            onUploadSuccess={handleUploadSuccess} 
            maxFiles={1} 
            label="Ganti Foto (1 file)" 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button 
          onClick={handleSave} 
          disabled={isPending || photoUrl === currentPhoto} 
          className="btn btn-primary"
        >
          {isPending ? 'Menyimpan...' : 'Simpan Foto'}
        </button>
        {photoUrl && (
          <button 
            type="button" 
            className="btn btn-outline" 
            style={{ color: 'var(--danger)' }}
            onClick={() => { setPhotoUrl(null) }}
            disabled={isPending}
          >
            Hapus Foto
          </button>
        )}
      </div>
    </div>
  )
}
