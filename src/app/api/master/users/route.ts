import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'


export async function GET() {
  const session = await getSession()

  // Halaman /register (tanpa login) hanya butuh daftar AFA untuk dropdown
  if (!session || !['ADMIN', 'SPV'].includes(session.role)) {
    const afas = await prisma.user.findMany({
      where: { role: { in: ['AFA', 'PLANTATION'] }, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(afas)
  }

  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, name: true, role: true, isActive: true, photo: true,
      email: true, phone: true, areaId: true, afaId: true, createdAt: true,
      area: { select: { id: true, name: true } },
      afa: { select: { id: true, name: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  })
  return NextResponse.json(users)
}
