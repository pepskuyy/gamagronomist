'use client'

import dynamic from 'next/dynamic'
import { ComponentProps } from 'react'

const OpportunityMapInner = dynamic(
  () => import('./OpportunityMapInner'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: '540px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          borderRadius: 'var(--radius-lg, 0.75rem)',
          color: '#64748b',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid #cbd5e1',
            borderTopColor: '#0284c7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat Peta Opportunity Finder...</span>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    ),
  }
)

export default function OpportunityMap(props: ComponentProps<typeof OpportunityMapInner>) {
  return <OpportunityMapInner {...props} />
}
