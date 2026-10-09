'use client'

import { useEffect, useState } from 'react'

interface InvoiceItem {
  item_no?: string
  item_name: string
  quantity: number
  unit?: string
  unit_price?: number
  total_price?: number
}

interface InvoiceHistory {
  id_invoice: string
  tanggal: string
  status: string
  omset: number
  items: InvoiceItem[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  store: {
    customer_id: string
    name: string
    city?: string | null
    default_salesman?: string | null
    distance_km: number
  } | null
}

export default function StoreHistoryModal({ isOpen, onClose, store }: Props) {
  const [invoices, setInvoices] = useState<InvoiceHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !store) return

    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (store.customer_id) params.set('customerId', store.customer_id)
    if (store.name) params.set('storeName', store.name)

    fetch(`/api/demoplot-impact/store-history?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Gagal memuat riwayat transaksi toko.')
        }
        return res.json()
      })
      .then((data) => {
        setInvoices(data.invoices || [])
        setLoading(false)
      })
      .catch((err: any) => {
        setError(err.message || 'Terjadi kesalahan sistem.')
        setLoading(false)
      })
  }, [isOpen, store])

  if (!isOpen || !store) return null

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'var(--surface-2)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🏪</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{store.name}</h3>
            </div>
            <div
              style={{
                marginTop: '0.35rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <span>📍 {store.city || 'Kota -'}</span>
              <span>📏 Jarak: {store.distance_km} km dari demoplot</span>
              {store.default_salesman && <span>👤 Sales: {store.default_salesman}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '9999px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#475569',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Riwayat Pembelian 12 Bulan Terakhir ({invoices.length} Faktur)
            </h4>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: '32px',
                  height: '32px',
                  border: '3px solid #cbd5e1',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: '0.75rem',
                }}
              />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Memuat riwayat transaksi dari faktur penjualan...</p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1rem',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              ⚠️ {error}
            </div>
          ) : invoices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem',
                background: 'var(--surface-2)',
                borderRadius: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <p style={{ margin: 0 }}>Belum ada data faktur pembelian yang tercatat dalam 12 bulan terakhir untuk toko ini.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {invoices.map((inv) => {
                const isRetur = (inv.status || '').toLowerCase().includes('retur')
                return (
                  <div
                    key={inv.id_invoice}
                    style={{
                      border: `1px solid ${isRetur ? '#fecaca' : 'var(--border)'}`,
                      borderRadius: '0.65rem',
                      padding: '1rem',
                      background: isRetur ? '#fff5f5' : '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                          {inv.id_invoice}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: isRetur ? '#fee2e2' : '#dcfce7',
                            color: isRetur ? '#b91c1c' : '#15803d',
                          }}
                        >
                          {inv.status || 'Terkirim'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          📅 {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(inv.tanggal))}
                        </span>
                        <strong
                          style={{
                            fontSize: '0.95rem',
                            color: isRetur ? '#dc2626' : '#15803d',
                          }}
                        >
                          {formatRp(inv.omset)}
                        </strong>
                      </div>
                    </div>

                    {/* Items table / list */}
                    {Array.isArray(inv.items) && inv.items.length > 0 ? (
                      <div
                        style={{
                          background: 'var(--surface-2)',
                          borderRadius: '0.5rem',
                          padding: '0.6rem 0.8rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {inv.items.map((it, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: idx < inv.items.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                paddingBottom: idx < inv.items.length - 1 ? '0.35rem' : '0',
                              }}
                            >
                              <span style={{ fontWeight: 600, color: '#334155' }}>
                                • {it.item_name || it.item_no || 'Produk'}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {it.quantity} {it.unit || 'PCS'} {it.total_price ? `(${formatRp(it.total_price)})` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--surface-2)',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
