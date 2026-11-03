'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'

type Notification = {
  id: string
  title: string
  message: string
  isRead: boolean
  link: string | null
  createdAt: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifications(data)
        }
      } catch (err) {
        console.error('Failed to fetch notifications')
      }
    }
    fetchNotifs()
    // Poll every 30s — dilewati saat tab tersembunyi (hemat request & query DB),
    // lalu fetch segera ketika tab kembali terlihat.
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') fetchNotifs()
    }, 30000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifs()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_all' })
      })
      setNotifications(notifications.map(n => ({ ...n, isRead: true })))
    } catch (err) {}
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch (err) {}
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHrs / 24)

    if (diffMins < 1) return 'Baru saja'
    if (diffMins < 60) return `${diffMins} mnt lalu`
    if (diffHrs < 24) return `${diffHrs} jam lalu`
    if (diffDays < 7) return `${diffDays} hari lalu`
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(date)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button 
        onClick={handleOpen}
        style={{ 
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)'
        }}
      >
        <Bell size={20} strokeWidth={1.75} style={{ display: 'block' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px', background: 'var(--danger)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 600, padding: '0.125rem 0.375rem', borderRadius: '9999px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '320px', 
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-lg)',
          zIndex: 50, overflow: 'hidden', border: '1px solid var(--border)'
        }}>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Notifikasi</h4>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={{ 
                background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontWeight: 500 
              }}>Tandai semua dibaca</button>
            )}
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada notifikasi
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => {
                    if (!n.isRead) markAsRead(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                  style={{ 
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)',
                    background: n.isRead ? 'var(--surface)' : 'var(--primary-light)', 
                    cursor: n.link ? 'pointer' : 'default',
                    transition: 'var(--transition)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: n.isRead ? 400 : 600, color: 'var(--text-main)', paddingRight: '1rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(n.createdAt)}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.message}</div>
                  {!n.isRead && (
                    <div style={{ position: 'absolute', top: '0.875rem', right: '0.75rem', width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
