import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireApiSession } from '@/lib/session'

export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const stores = await prisma.store.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(stores)
}
