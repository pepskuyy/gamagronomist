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
  targetDemoPlot: '🌱 Demo Plot',
  targetVisitKios: '🏪 Visit Kios',
  targetGathering: '🤝 Farmer Gathering',
  targetCompany: '🏢 Visit Company',
  targetBehavior: '📋 Customer Behavior',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-white">
          <h3 className="text-lg font-bold">Set Target KPI</h3>
          <p className="text-green-100 text-sm mt-0.5">{monthName}</p>
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
                className="w-24 text-center border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  )
}
