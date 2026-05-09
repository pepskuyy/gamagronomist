import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'


export async function GET() {
  try {
    const requests = await (prisma as any).accountRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    })
    return NextResponse.json(requests)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
