import KpiDashboard from '@/components/KpiDashboard'

interface User {
  id: string
  username: string
  name: string
  role: string
}

interface KpiSectionProps {
  ownerUserId: string
  subordinates: User[]
}

export default function KpiSection({ ownerUserId, subordinates }: KpiSectionProps) {
  return (
    <div className="card" style={{ marginBottom: '2.5rem' }}>
      <KpiDashboard ownerUserId={ownerUserId} subordinates={subordinates} />
    </div>
  )
}
