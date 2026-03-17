'use client'

interface KpiBarProps {
  label: string
  icon: string
  actual: number
  target: number
  color: string
}

function KpiBar({ label, icon, actual, target, color }: KpiBarProps) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
  const isOnTrack = pct >= 100
  const isWarning = pct >= 60 && pct < 100
  const barColor = isOnTrack ? 'bg-emerald-500' : isWarning ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 text-xl flex-shrink-0 text-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-gray-700 truncate">{label}</span>
          <span className="text-xs font-bold text-gray-500 ml-2 flex-shrink-0">
            {actual}
            <span className="font-normal text-gray-400">/{target === 0 ? '–' : target}</span>
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${target === 0 ? 0 : pct}%` }}
          />
        </div>
      </div>
      <div className={`w-12 text-right text-xs font-bold flex-shrink-0 ${isOnTrack ? 'text-emerald-600' : isWarning ? 'text-yellow-600' : 'text-red-500'}`}>
        {target === 0 ? '–' : `${pct}%`}
      </div>
    </div>
  )
}

interface KpiPanelProps {
  actuals: {
    demoPlot: number
    visitKios: number
    gathering: number
    company: number
    behavior: number
  }
  targets: {
    targetDemoPlot: number
    targetVisitKios: number
    targetGathering: number
    targetCompany: number
    targetBehavior: number
  }
}

export default function KpiPanel({ actuals, targets }: KpiPanelProps) {
  const items = [
    { key: 'demoPlot', label: 'Demo Plot', icon: '🌱', actual: actuals.demoPlot, target: targets.targetDemoPlot },
    { key: 'visitKios', label: 'Visit Kios', icon: '🏪', actual: actuals.visitKios, target: targets.targetVisitKios },
    { key: 'gathering', label: 'Farmer Gathering', icon: '🤝', actual: actuals.gathering, target: targets.targetGathering },
    { key: 'company', label: 'Visit Company', icon: '🏢', actual: actuals.company, target: targets.targetCompany },
    { key: 'behavior', label: 'Customer Behavior', icon: '📋', actual: actuals.behavior, target: targets.targetBehavior },
  ]

  const overall = targets.targetDemoPlot + targets.targetVisitKios + targets.targetGathering + targets.targetCompany + targets.targetBehavior
  const totalActual = actuals.demoPlot + actuals.visitKios + actuals.gathering + actuals.company + actuals.behavior
  const overallPct = overall > 0 ? Math.min(Math.round((totalActual / overall) * 100), 100) : 0

  return (
    <div>
      {/* Overall progress ring summary */}
      <div className="flex items-center gap-5 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={overallPct >= 100 ? '#10b981' : overallPct >= 60 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3.5"
              strokeDasharray={`${(overallPct / 100) * 97.4} 97.4`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-extrabold text-gray-800">{overallPct}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Capaian Bulan Ini</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalActual} <span className="text-base font-medium text-gray-400">/ {overall} aktivitas</span></p>
          <p className={`text-sm font-semibold mt-1 ${overallPct >= 100 ? 'text-emerald-600' : overallPct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
            {overallPct >= 100 ? '✅ Target Tercapai!' : overallPct >= 60 ? '⚡ Mendekati Target' : '🔴 Perlu Perhatian'}
          </p>
        </div>
      </div>

      {/* Per-activity bars */}
      <div>
        {items.map(item => (
          <KpiBar key={item.key} label={item.label} icon={item.icon} actual={item.actual} target={item.target} color="green" />
        ))}
      </div>
    </div>
  )
}
