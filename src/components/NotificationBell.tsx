'use client'

import { useState, useEffect, useRef } from 'react'

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
    // Poll every 30s
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
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
          padding: '0.5rem', borderRadius: '50%', color: 'var(--text-muted)'
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '4px', background: 'var(--danger)', color: 'white',
            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '9999px', lineHeight: 1
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '320px', 
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', 
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', 
          zIndex: 50, overflow: 'hidden', border: '1px solid var(--border)'
        }}>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
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
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', 
                    background: n.isRead ? 'var(--surface)' : 'var(--primary-light)', 
                    cursor: n.link ? 'pointer' : 'default',
                    transition: 'background 0.2s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: n.isRead ? 500 : 700, color: 'var(--text-main)', paddingRight: '1rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(n.createdAt)}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                  {!n.isRead && (
                    <div style={{ position: 'absolute', top: '0.85rem', right: '0.75rem', width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} />
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
