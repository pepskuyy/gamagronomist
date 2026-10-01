import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'
import OpenApiClient from './OpenApiClient'

export default async function OpenApiPage() {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)

  if (!session?.userId || session.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    }
  })

  return <OpenApiClient initialKeys={apiKeys} />
}
