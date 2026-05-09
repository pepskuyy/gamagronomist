import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'


export async function GET() {
  const users = await prisma.user.findMany({
    include: { area: { select: { id: true, name: true } }, afa: { select: { id: true, name: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  })
  return NextResponse.json(users)
}
