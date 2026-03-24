'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  type: 'cb' | 'demoplot'
  id: string
  deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }>
}

export default function ReportAdminActions({ type, id, deleteAction }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus laporan ini secara permanen?')) return
    
    setLoading(true)
    const res = await deleteAction(id)
    if (res?.error) {
      alert(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/reports')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Link href={`/dashboard/reports/${type}/${id}/edit`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
        ✏️ Edit
      </Link>
      <button onClick={handleDelete} disabled={loading} className="btn" style={{ background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
        {loading ? '🗑️ Menghapus...' : '🗑️ Hapus'}
      </button>
    </div>
  )
}
