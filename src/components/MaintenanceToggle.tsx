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
        // Saat keluar dari maintenance, minta Service Worker membuang seluruh
        // cache HTML. Tanpa ini, client yang sempat menyimpan halaman
        // maintenance bisa tetap melihatnya walau mode sudah dimatikan.
        if (!newValue && typeof navigator !== 'undefined') {
          navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_ALL_PAGES' })
        }
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
          backgroundColor: isActive ? 'var(--danger)' : 'var(--surface-3)',
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'var(--transition)',
          display: 'flex',
          alignItems: 'center',
          padding: '2px'
        }}
      >
        <div 
          style={{
            width: '22px',
            height: '22px',
            backgroundColor: '#fff',
            borderRadius: '50%',
            transition: 'transform var(--dur-fast) var(--ease)',
            transform: isActive ? 'translateX(24px)' : 'translateX(0)',
            boxShadow: 'var(--shadow-sm)'
          }}
        />
      </button>
      <div>
        <span style={{ fontWeight: 500, color: isActive ? 'var(--danger)' : 'var(--text-main)' }}>
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
