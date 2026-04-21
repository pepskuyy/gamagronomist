import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import OpnameFormClient from './OpnameFormClient'
import ApproveListServer from './ApproveListServer'
import { OpnameTabs } from './OpnameTabs'
import SampleOpnameClient from './SampleOpnameClient'

export default async function OpnamePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  const isSPVorADMIN = session?.role === 'ADMIN' || session?.role === 'SPV'

  if (!isSPVorADMIN) {
    // AFA / FO hanya melihat form pengajuan opname biasa
    return <OpnameFormClient />
  }

  // SPV / ADMIN: Tab Persetujuan + Tab Opname Gudang Sampel
  return (
    <OpnameTabs
      approvalTab={<ApproveListServer />}
      sampleTab={<SampleOpnameClient />}
    />
  )
}
