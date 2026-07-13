'use server'

import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function toggleMaintenanceMode(isActive: boolean) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (session?.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  await prisma.systemConfig.upsert({
    where: { key: 'maintenance_mode' },
    update: { value: isActive ? 'true' : 'false' },
    create: { key: 'maintenance_mode', value: isActive ? 'true' : 'false', label: 'Maintenance Mode' }
  })

  // Revalidate entire app to apply maintenance status immediately
  revalidatePath('/', 'layout')
}
