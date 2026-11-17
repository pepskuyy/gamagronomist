import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import OpnameFormClient from './OpnameFormClient'
import ApproveListServer from './ApproveListServer'
import { OpnameTabs } from './OpnameTabs'
import SampleOpnameClient from './SampleOpnameClient'
import MyOpnameHistory from './MyOpnameHistory'

export default async function OpnamePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  const isSPVorADMIN = session?.role === 'ADMIN' || session?.role === 'SPV'

  if (!isSPVorADMIN) {
    // AFA / FO hanya melihat form pengajuan opname biasa
    return (
      <>
        <OpnameFormClient />
        {session?.userId && <MyOpnameHistory userId={session.userId} />}
      </>
    )
  }

  // SPV / ADMIN: Tab Persetujuan + Tab Opname Gudang Sampel
  return (
    <OpnameTabs
      approvalTab={<ApproveListServer searchParams={await searchParams} />}
      sampleTab={<SampleOpnameClient />}
    />
  )
}
