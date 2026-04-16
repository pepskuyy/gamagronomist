import TargetDashboard from '@/components/TargetDashboard'

type Area = { id: string; name: string }

interface TargetSectionProps {
  isSPV: boolean
  areas: Area[]
}

export default function KpiSection({ isSPV, areas }: TargetSectionProps) {
  return (
    <div className="card" style={{ marginBottom: '2.5rem' }}>
      <TargetDashboard isSPV={isSPV} areas={areas} />
    </div>
  )
}
