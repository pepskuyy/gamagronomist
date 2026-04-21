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
      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ 
          width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-hover)', 
          border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
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
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
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
