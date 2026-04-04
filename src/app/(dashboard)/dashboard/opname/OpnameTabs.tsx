'use client'

import { useState } from 'react'
import Link from 'next/link'

export function OpnameTabs({ formTab, approvalTab }: { formTab: React.ReactNode, approvalTab: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'FORM' | 'APPROVE'>('APPROVE')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)' }}>← Kembali ke Dashboard</Link>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('APPROVE')}
          style={{
             background: 'none', border: 'none', padding: '0.75rem 1rem', 
             fontWeight: activeTab === 'APPROVE' ? 600 : 400,
             borderBottom: activeTab === 'APPROVE' ? '2px solid var(--primary)' : '2px solid transparent',
             cursor: 'pointer', color: activeTab === 'APPROVE' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          Persetujuan SPV
        </button>
        <button 
          onClick={() => setActiveTab('FORM')}
          style={{
             background: 'none', border: 'none', padding: '0.75rem 1rem', 
             fontWeight: activeTab === 'FORM' ? 600 : 400,
             borderBottom: activeTab === 'FORM' ? '2px solid var(--primary)' : '2px solid transparent',
             cursor: 'pointer', color: activeTab === 'FORM' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          Pengajuan Opname Anda
        </button>
      </div>

      <div>
        {activeTab === 'APPROVE' ? approvalTab : formTab}
      </div>
    </div>
  )
}
