import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import OpnameFormClient from './OpnameFormClient'
import ApproveListServer from './ApproveListServer'
import { OpnameTabs } from './OpnameTabs'

export default async function OpnamePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  const isSPVorADMIN = session?.role === 'ADMIN' || session?.role === 'SPV'

  if (!isSPVorADMIN) {
    // Regular AFA or FO only sees the Form
    return <OpnameFormClient />
  }

  // SPV or ADMIN sees Tabs
  return (
    <OpnameTabs
      formTab={<OpnameFormClient />}
      approvalTab={<ApproveListServer />}
    />
  )
}
