'use client'

import { useState } from 'react'

interface ImageUploaderProps {
  onUploadSuccess: (urls: string[]) => void
  label?: string
  maxFiles?: number
}

export default function ImageUploader({ onUploadSuccess, label = "Dokumentasi (Upload Foto)", maxFiles = 3 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (uploadedUrls.length + files.length > maxFiles) {
      setError(`Maksimal ${maxFiles} foto diizinkan.`)
      return
    }

    setUploading(true)
    setError(null)
    
    const newUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
       const file = files[i]
       const formData = new FormData()
       formData.append('file', file)

       try {
         const res = await fetch('/api/upload', {
           method: 'POST',
           body: formData
         })
         
         const data = await res.json()
         
         if (!res.ok) {
           throw new Error(data.error || 'Gagal upload')
         }
         
         newUrls.push(data.url)
       } catch (err: any) {
         setError(err.message)
       }
    }

    const combinedUrls = [...uploadedUrls, ...newUrls]
    setUploadedUrls(combinedUrls)
    onUploadSuccess(combinedUrls) // Pass back to parent form
    setUploading(false)
    
    // reset input
    e.target.value = ''
  }

  const removeImage = (indexToRemove: number) => {
    const newUrls = uploadedUrls.filter((_, idx) => idx !== indexToRemove)
    setUploadedUrls(newUrls)
    onUploadSuccess(newUrls)
  }

  return (
    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
      <label className="form-label">{label} {uploadedUrls.length}/{maxFiles}</label>
      
      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {uploadedUrls.map((url, idx) => (
          <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
             <img src={url} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
             <button 
               type="button" 
               onClick={() => removeImage(idx)}
               style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
             >
               ✕
             </button>
          </div>
        ))}
        
        {uploadedUrls.length < maxFiles && (
          <label style={{ 
            width: '100px', height: '100px', 
            borderRadius: 'var(--radius-md)', 
            border: '2px dashed var(--border)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: 'var(--surface-hover)',
            color: 'var(--text-muted)',
            fontSize: '0.8rem'
          }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>+</span>
            {uploading ? 'Uploading...' : 'Tambah'}
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
      
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Format: JPG, PNG. Rekomendasi rasio 4:3 atau 16:9.</p>
    </div>
  )
}
