'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

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
      <Link href={`/dashboard/reports/${type}/${id}/edit`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.85rem' }}>
        <Pencil size={16} strokeWidth={1.75} className="icon-inline" />
        Edit
      </Link>
      <button onClick={handleDelete} disabled={loading} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.85rem' }}>
        <Trash2 size={16} strokeWidth={1.75} className="icon-inline" />
        {loading ? 'Menghapus...' : 'Hapus'}
      </button>
    </div>
  )
}
