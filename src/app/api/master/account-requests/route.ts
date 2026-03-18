import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

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
