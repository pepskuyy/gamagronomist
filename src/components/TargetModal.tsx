'use client'

import { useState, useTransition } from 'react'
import { setKpiTarget } from '@/app/actions/kpi'

interface TargetValues {
  targetDemoPlot: number
  targetVisitKios: number
  targetGathering: number
  targetCompany: number
  targetBehavior: number
}

interface TargetModalProps {
  userId: string
  month: number
  year: number
  currentTargets: TargetValues
  onClose: () => void
  onSaved: () => void
}

const FIELD_LABELS: Record<keyof TargetValues, string> = {
  targetDemoPlot: 'Demo Plot',
  targetVisitKios: 'Visit Kios',
  targetGathering: 'Farmer Gathering',
  targetCompany: 'Visit Company',
  targetBehavior: 'Customer Behavior',
}

export default function TargetModal({ userId, month, year, currentTargets, onClose, onSaved }: TargetModalProps) {
  const [values, setValues] = useState<TargetValues>({ ...currentTargets })
  const [isPending, startTransition] = useTransition()

  const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const handleSave = () => {
    startTransition(async () => {
      await setKpiTarget({ userId, month, year, ...values })
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>Set Target KPI</h3>
          <p className="text-gray-500 text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{monthName}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {(Object.keys(FIELD_LABELS) as Array<keyof TargetValues>).map((key) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 flex-1">
                {FIELD_LABELS[key]}
              </label>
              <input
                type="number"
                min={0}
                value={values[key]}
                onChange={(e) => setValues(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-24 text-center border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium num focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="btn btn-outline flex-1"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn btn-primary flex-1"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  )
}
