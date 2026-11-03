'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { ComponentProps } from 'react'
import { Map as MapIcon, RefreshCw } from 'lucide-react'

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
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-lg, 0.75rem)',
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
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat Peta Opportunity Finder...</span>
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
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-lg, 0.75rem)',
            color: 'var(--text-secondary)',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid var(--border)',
          }}
        >
          <MapIcon size={32} strokeWidth={1.5} style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Peta Membutuhkan Refresh
          </h4>
          <p style={{ margin: '0.375rem 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
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
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <RefreshCw size={16} strokeWidth={1.75} /> Muat Ulang Peta
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
