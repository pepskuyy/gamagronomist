'use client'

import dynamic from 'next/dynamic'
import { ComponentProps } from 'react'

const DemoplotImpactMapInner = dynamic(
  () => import('./DemoplotImpactMapInner'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          borderRadius: 'var(--radius-lg)',
          color: '#64748b',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid #cbd5e1',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>🗺️ Memuat peta analitik demoplot...</span>
      </div>
    ),
  }
)

export default function DemoplotImpactMap(props: ComponentProps<typeof DemoplotImpactMapInner>) {
  return <DemoplotImpactMapInner {...props} />
}
