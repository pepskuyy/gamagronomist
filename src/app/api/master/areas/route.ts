import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const areas = await prisma.area.findMany({
    include: { users: { select: { id: true, name: true, role: true } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(areas)
}
