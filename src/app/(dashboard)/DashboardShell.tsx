'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

type SidebarProps = {
  session: { name: string; role: string; photo?: string | null }
  children: React.ReactNode
}

import NotificationBell from '@/components/NotificationBell'

// Nav icon SVGs — clean, modern look matching the reference
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  master: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  stock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14M5 12h14M5 16h6"/><rect x="2" y="4" width="20" height="16" rx="2"/>
    </svg>
  ),
  demoplot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2v10l6.5 3.5"/>
      <circle cx="12" cy="12" r="3"/><path d="M5 19.5C5.5 18 6 15 12 15s6.5 3 7 4.5"/>
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  opname: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  so: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  ),
}

export default function DashboardShell({ session, children }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard',          label: 'Dashboard',          icon: Icons.dashboard, show: true },
    { href: '/dashboard/master',   label: 'Master Data',        icon: Icons.master,    show: session?.role === 'ADMIN' || session?.role === 'SPV' },
    { href: '/dashboard/stock',    label: ['FAM','WHM'].includes(session?.role) ? 'Approval Stok' : 'Manajemen Stok', icon: Icons.stock, show: session?.role !== 'BD' },
    { href: '/dashboard/reports',  label: 'Laporan Aktivitas',  icon: Icons.reports,   show: !['BD', 'FAM', 'WHM'].includes(session?.role) },
    { href: '/dashboard/opname',   label: 'Stock Opname',       icon: Icons.opname,    show: !['BD', 'FAM', 'WHM'].includes(session?.role) },
    { href: '/dashboard/so',       label: 'Tracking SO',        icon: Icons.so,        show: ['SPV', 'ADMIN', 'BD'].includes(session?.role) },
    { href: '/dashboard/settings', label: 'Pengaturan Akun',    icon: Icons.settings,  show: true },
  ]

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const roleColor: Record<string, string> = {
    ADMIN: '#b91c1c', SPV: '#a16207', AFA: '#15803d', FO: '#1d4ed8', FAM: '#7c3aed', WHM: '#0891b2', BD: '#c2410c'
  }

  return (
    <div className="dashboard-layout">
      {/* Mobile Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--primary)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(255,255,255,0.2)"/>
            <path d="M12 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-2.7 0-5.8 1.29-6 2h12c-.2-.71-3.3-2-6-2z" fill="white"/>
          </svg>
        </div>

        {/* Mobile close */}
        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>✕</button>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, width: '100%', alignItems: 'center' }}>
          {navItems.filter(n => n.show).map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-icon-btn ${isActive(item.href) ? 'active' : ''}`}
              data-label={item.label}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User avatar + logout */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0, overflow: 'hidden' }}>
            {session?.photo ? (
              <img src={session.photo} alt={session.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              session?.name?.charAt(0)?.toUpperCase()
            )}
          </div>
          <form action="/api/auth/logout" method="POST" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button type="submit" className="nav-icon-btn" data-label="Keluar" title="Keluar" style={{ color: 'var(--danger)' }}>
              {Icons.logout}
              <span className="nav-label" style={{ color: 'var(--danger)' }}>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Agrolens</span>
              <span style={{ color: 'var(--border)', fontWeight: 300 }}>|</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Portal Agronomi</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NotificationBell />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{session?.name?.split(' ')[0]}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: roleColor[session?.role] || 'var(--text-muted)' }}>{session?.role}</div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-full)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                {session?.name?.charAt(0)?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-container">
          {children}
        </div>
      </main>
    </div>
  )
}
