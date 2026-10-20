import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { invalidateCacheTag, CACHE_TAGS } from '@/lib/data-cache'


export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)
  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  }

  const result = await prisma.store.deleteMany({ where: { accurateId: null } })
  invalidateCacheTag(CACHE_TAGS.stores)
  return NextResponse.json({ deleted: result.count })
}
