'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
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

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[OpportunityMap] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '540px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            borderRadius: 'var(--radius-lg, 0.75rem)',
            color: '#475569',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺️</div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            Peta Membutuhkan Refresh
          </h4>
          <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.82rem', color: '#64748b', maxWidth: '320px' }}>
            Modul visual peta Leaflet siap dimuat ulang.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            🔄 Muat Ulang Peta
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function OpportunityMap(props: ComponentProps<typeof OpportunityMapInner>) {
  return (
    <MapErrorBoundary>
      <OpportunityMapInner {...props} />
    </MapErrorBoundary>
  )
}
