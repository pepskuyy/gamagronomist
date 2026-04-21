'use client'

import { useState, useEffect, useTransition } from 'react'
import { adjustSampleStock } from '@/app/actions/sample-stock'

type Balance = { productId: string; productName: string; unit: string; balance: number }

export default function SampleOpnameClient() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // { productId → { actual: string, notes: string } }
  const [opnameData, setOpnameData] = useState<Record<string, { actual: string; notes: string }>>({})

  useEffect(() => { fetchBalances() }, [])

  async function fetchBalances() {
    setLoading(true)
    const res = await fetch('/api/sample-stock?view=balance')
    if (res.ok) {
      const data: Balance[] = await res.json()
      setBalances(data)
    }
    setLoading(false)
  }

  function handleSubmit() {
    setError(null); setSuccess(null)
    const adjustments: { productId: string; difference: number; notes: string }[] = []

    for (const b of balances) {
      const data = opnameData[b.productId]
      if (data && data.actual !== '') {
        const actual = parseFloat(data.actual)
        if (!isNaN(actual) && actual !== b.balance) {
          adjustments.push({ productId: b.productId, difference: actual - b.balance, notes: data.notes })
        }
      }
    }

    if (adjustments.length === 0) {
      setError('Tidak ada penyesuaian yang perlu disimpan (tidak ada selisih).')
      return
    }

    const fd = new FormData()
    fd.append('adjustments', JSON.stringify(adjustments))
    startTransition(async () => {
      const res = await adjustSampleStock(fd)
      if (res?.error) {
        setError(res.error)
      } else {
        setSuccess('Opname berhasil disimpan! Stok sudah disesuaikan.')
        setOpnameData({})
        fetchBalances()
      }
    })
  }

  const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
  const thStyle: React.CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>⚖️ Opname Stok Gudang Sampel</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Input stok aktual per produk dalam satuan kemasan. Adjustment akan langsung tercatat tanpa perlu persetujuan.
          </p>
        </div>
        <button onClick={handleSubmit} disabled={isPending} className="btn btn-primary">
          {isPending ? 'Menyimpan...' : '✅ Simpan Semua Penyesuaian'}
        </button>
      </div>

      {error   && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#166534', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

      <div className="table-card">
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat saldo stok sampel...</p>
        ) : balances.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada stok di Gudang Sampel.</p>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Produk</th>
                  <th style={thStyle}>Stok Sistem</th>
                  <th style={thStyle}>Stok Aktual (Fisik)</th>
                  <th style={thStyle}>Selisih</th>
                  <th style={thStyle}>Catatan / Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {balances.map(b => {
                  const data   = opnameData[b.productId] || { actual: '', notes: '' }
                  const actual = parseFloat(data.actual)
                  const diff   = !data.actual || isNaN(actual) ? 0 : actual - b.balance
                  const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : 'var(--text-muted)'

                  return (
                    <tr key={b.productId} style={{ background: diff !== 0 ? '#fffbeb' : 'var(--surface)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{b.productName}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}>
                        {b.balance}
                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '4px' }}>{b.unit}</span>
                      </td>
                      <td style={{ ...tdStyle }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="number" step="1" min="0"
                            placeholder={b.balance.toString()}
                            className="form-control"
                            style={{ width: '90px', padding: '0.4rem 0.5rem' }}
                            value={data.actual}
                            onChange={e => setOpnameData({ ...opnameData, [b.productId]: { ...data, actual: e.target.value } })}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{b.unit}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: diffColor, fontSize: '0.95rem' }}>
                        {data.actual === '' ? '—' : diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={diff !== 0 ? 'Keterangan wajib diisi...' : 'opsional'}
                          style={{ padding: '0.4rem 0.5rem', borderColor: diff !== 0 && !data.notes ? 'var(--danger)' : undefined }}
                          value={data.notes}
                          onChange={e => setOpnameData({ ...opnameData, [b.productId]: { ...data, notes: e.target.value } })}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
