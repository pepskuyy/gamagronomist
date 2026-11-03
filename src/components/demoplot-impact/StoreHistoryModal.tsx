'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Calendar, MapPin, Ruler, Store, User, X } from 'lucide-react'

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
        background: 'rgba(23, 23, 23, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
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
            background: 'var(--surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Store size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{store.name}</h3>
            </div>
            <div
              style={{
                marginTop: '0.375rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} strokeWidth={1.75} /> {store.city || 'Kota -'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Ruler size={14} strokeWidth={1.75} /> Jarak: <span className="num">{store.distance_km}</span><span className="unit">km</span> dari demoplot</span>
              {store.default_salesman && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><User size={14} strokeWidth={1.75} /> Sales: {store.default_salesman}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
            aria-label="Tutup"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
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
                  border: '3px solid var(--border)',
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
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} /> {error}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {invoices.map((inv) => {
                const isRetur = (inv.status || '').toLowerCase().includes('retur')
                return (
                  <div
                    key={inv.id_invoice}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      background: isRetur ? 'var(--danger-bg)' : 'var(--surface)',
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
                        <strong style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)', fontFamily: 'var(--font-mono-stack)' }}>
                          {inv.id_invoice}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--radius-xs)',
                            background: isRetur ? 'var(--danger-bg)' : 'var(--success-bg)',
                            color: isRetur ? 'var(--danger)' : 'var(--success)',
                          }}
                        >
                          {inv.status || 'Terkirim'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={14} strokeWidth={1.75} /> {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(inv.tanggal))}
                        </span>
                        <strong
                          className="num"
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: isRetur ? 'var(--danger)' : 'var(--text-main)',
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
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {inv.items.map((it, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: idx < inv.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                                paddingBottom: idx < inv.items.length - 1 ? '0.375rem' : '0',
                              }}
                            >
                              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                                • {it.item_name || it.item_no || 'Produk'}
                              </span>
                              <span className="num" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {it.quantity}<span className="unit">{it.unit || 'PCS'}</span> {it.total_price ? `(${formatRp(it.total_price)})` : ''}
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
            background: 'var(--surface)',
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
