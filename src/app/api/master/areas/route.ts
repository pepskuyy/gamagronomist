import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'


export async function GET() {
  const areas = await prisma.area.findMany({
    include: { users: { select: { id: true, name: true, role: true } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(areas)
}
