'use client'

import { useState, useTransition } from 'react'
import { toggleMaintenanceMode } from '@/app/actions/system'

export default function MaintenanceToggle({ initialStatus }: { initialStatus: boolean }) {
  const [isActive, setIsActive] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newValue = !isActive
    setIsActive(newValue)
    startTransition(async () => {
      try {
        await toggleMaintenanceMode(newValue)
      } catch (err) {
        setIsActive(!newValue)
        alert('Gagal mengubah status maintenance')
      }
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
      <button 
        onClick={handleToggle}
        disabled={isPending}
        style={{
          position: 'relative',
          width: '50px',
          height: '26px',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: isActive ? '#dc2626' : '#d1d5db',
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          padding: '2px'
        }}
      >
        <div 
          style={{
            width: '22px',
            height: '22px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'transform 0.2s',
            transform: isActive ? 'translateX(24px)' : 'translateX(0)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </button>
      <div>
        <span style={{ fontWeight: 600, color: isActive ? '#dc2626' : 'var(--text)' }}>
          {isActive ? 'Mode Maintenance Aktif' : 'Mode Maintenance Nonaktif'}
        </span>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isActive 
            ? 'Semua pengguna kecuali Admin tidak dapat mengakses sistem saat ini.'
            : 'Sistem berjalan normal dan dapat diakses oleh semua pengguna.'}
        </p>
      </div>
    </div>
  )
}
