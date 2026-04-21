'use client'

import { useState } from 'react'
import Link from 'next/link'

export function OpnameTabs({
  approvalTab,
  sampleTab,
}: {
  approvalTab: React.ReactNode
  sampleTab: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'APPROVE' | 'SAMPLE'>('APPROVE')

  const tabs: { key: 'APPROVE' | 'SAMPLE'; label: string }[] = [
    { key: 'APPROVE', label: '✅ Persetujuan SPV' },
    { key: 'SAMPLE',  label: '⚖️ Opname Gudang Sampel' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)' }}>← Kembali ke Dashboard</Link>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: 'none', border: 'none', padding: '0.75rem 1.25rem',
              fontWeight: activeTab === t.key ? 700 : 400,
              borderBottom: activeTab === t.key ? '3px solid var(--primary)' : '3px solid transparent',
              cursor: 'pointer',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              marginBottom: '-2px',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'APPROVE' ? approvalTab : sampleTab}
      </div>
    </div>
  )
}
