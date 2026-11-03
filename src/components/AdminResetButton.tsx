'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { resetRequestToSubmitted } from '@/app/actions/afa-stock'

export function AdminResetButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleReset = () => {
    if (!confirm('Reset pengajuan ini ke status SUBMITTED?\n\nJika pengajuan SAMPEL sudah APPROVED, entri ledger akan di-reverse otomatis.\n\nLanjutkan?')) return
    startTransition(async () => {
      const res = await resetRequestToSubmitted(requestId)
      if (res?.error) {
        alert(res.error)
      } else {
        alert('Pengajuan berhasil di-reset ke SUBMITTED. SPV sekarang bisa memproses ulang.')
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleReset}
      className="btn"
      style={{
        padding: '0.375rem 0.75rem',
        fontSize: '0.8rem',
        background: 'var(--warning-bg)',
        color: 'var(--warning)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
      disabled={isPending}
      title="Reset ke SUBMITTED — hanya untuk ADMIN"
    >
      {isPending ? 'Memproses...' : <><RotateCcw size={16} strokeWidth={1.75} className="icon-inline" />Reset ke SPV</>}
    </button>
  )
}
