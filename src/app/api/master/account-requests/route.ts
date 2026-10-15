import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'


export async function GET() {
  const auth = await requireApiSession(['ADMIN', 'SPV'])
  if (auth instanceof NextResponse) return auth

  try {
    const requests = await (prisma as any).accountRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    })
    return NextResponse.json(requests)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
