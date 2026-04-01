'use client'

import { useState, useTransition } from 'react'
import { adjustStock } from '@/app/actions/stock-admin'

type StockAdjustmentModalProps = {
  isOpen: boolean
  onClose: () => void
  user: { id: string, name: string, role: string }
  products: { id: string, name: string, unit: string }[]
  onSuccess: () => void
}

export default function StockAdjustmentModal({ isOpen, onClose, user, products, onSuccess }: StockAdjustmentModalProps) {
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('userId', user.id)

    start(async () => {
      const res = await adjustStock(fd)
      if (res?.error) {
        setError(res.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛠️ Sesuaikan Stok
          </h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target User:</div>
            <div style={{ fontWeight: 600 }}>{user.name} <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{user.role}</span></div>
          </div>

          {error && <div className="alert-error" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Pilih Produk</label>
              <select name="productId" className="form-control" required>
                <option value="">-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Tipe Penyesuaian</label>
                <select name="type" className="form-control" required>
                  <option value="plus">➕ Tambah (+)</option>
                  <option value="minus">➖ Kurangi (-)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Jumlah</label>
                <input name="quantity" type="number" min="0.01" step="0.01" className="form-control" required placeholder="Contoh: 10" />
              </div>
            </div>

            <div>
              <label className="form-label">Keterangan (Harus diisi)</label>
              <textarea name="notes" rows={3} className="form-control" required placeholder="Jelaskan alasan penyesuaian stok ini..." />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Otomatis akan dikirimkan notifikasi ke user terkait.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isPending}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'Memproses...' : 'Simpan Penyesuaian'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .modal-content {
          background: var(--surface);
          width: 90%; max-width: 480px;
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
          animation: slideUp 0.3s ease-out;
        }
        .modal-header {
          padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
        }
        .modal-body { padding: 1.5rem; }
        .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted); }
        .close-btn:hover { color: var(--text-main); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
