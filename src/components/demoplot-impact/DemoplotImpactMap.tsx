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
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-muted)',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat peta analitik demoplot...</span>
      </div>
    ),
  }
)

export default function DemoplotImpactMap(props: ComponentProps<typeof DemoplotImpactMapInner>) {
  return <DemoplotImpactMapInner {...props} />
}
