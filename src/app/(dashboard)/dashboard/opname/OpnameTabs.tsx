'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Scale, ArrowLeft } from 'lucide-react'

export function OpnameTabs({
  approvalTab,
  sampleTab,
}: {
  approvalTab: React.ReactNode
  sampleTab: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'APPROVE' | 'SAMPLE'>('APPROVE')

  const tabs: { key: 'APPROVE' | 'SAMPLE'; label: string }[] = [
    { key: 'APPROVE', label: 'Persetujuan SPV' },
    { key: 'SAMPLE',  label: 'Opname Gudang Sampel' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><ArrowLeft size={16} strokeWidth={1.75} className="icon-inline" />Kembali ke Dashboard</Link>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: 'none', border: 'none', padding: '0.75rem 1.25rem',
              fontWeight: 500,
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              color: activeTab === t.key ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              marginBottom: '-1px',
              transition: 'var(--transition)',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {t.key === 'APPROVE' ? <CheckCircle2 size={16} strokeWidth={1.75} /> : <Scale size={16} strokeWidth={1.75} />}
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
