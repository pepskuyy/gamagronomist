'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

type SidebarProps = {
  session: {
    name: string
    role: string
  }
  children: React.ReactNode
}

export default function DashboardShell({ session, children }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: '📊 Dashboard', show: true },
    { href: '/dashboard/master', label: '⚙️ Master Data', show: session?.role === 'ADMIN' || session?.role === 'SPV' },
    { href: '/dashboard/stock', label: '📦 Manajemen Stok', show: true },
    { href: '/dashboard/demoplot', label: '🌾 Demo Plot', show: true },
    { href: '/dashboard/reports', label: '📝 Laporan Aktivitas', show: true },
    { href: '/dashboard/opname', label: '📋 Stock Opname', show: true },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="dashboard-layout">
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="logo" style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            🌱 Gamagronomist
          </div>
          <button className="sidebar-close-btn" onClick={closeSidebar} aria-label="Close menu">
            ✕
          </button>
        </div>
        
        <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          {navItems.filter(n => n.show).map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{session?.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role: {session?.role}</div>
          </div>
          
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="btn btn-outline" style={{ width: '100%' }}>
              🚪 Keluar
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Portal Gamagronomist</h2>
          </div>
          <div>
            <span className="badge badge-neutral">Sistem Internal</span>
          </div>
        </header>
        
        <div className="dashboard-container">
          {children}
        </div>
      </main>

      <style jsx>{`
        .nav-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: var(--text-main);
          border-radius: var(--radius-md);
          font-weight: 500;
          transition: var(--transition);
          text-decoration: none;
          font-size: 0.95rem;
        }
        .nav-item:hover {
          background-color: var(--surface-hover);
          color: var(--primary);
        }
        .nav-item.active {
          background-color: #D1FAE5;
          color: #065F46;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
