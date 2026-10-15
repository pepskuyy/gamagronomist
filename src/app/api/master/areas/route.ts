import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'


export async function GET() {
  const session = await getSession()

  // Halaman /register (tanpa login) hanya butuh id & nama area
  if (!session) {
    const areas = await prisma.area.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(areas)
  }

  const areas = await prisma.area.findMany({
    include: { users: { select: { id: true, name: true, role: true } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(areas)
}
