import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let users = []
    
    if (['AFA', 'PLANTATION'].includes(session.role)) {
      // AFA can see FOs in their area
      users = await prisma.user.findMany({
        where: { role: 'FO', areaId: session.areaId },
        select: { id: true, name: true, role: true }
      })
    } else if (session.role === 'ADMIN' || session.role === 'SPV') {
      // ADMIN/SPV can see all users
      users = await prisma.user.findMany({
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' }
      })
    }
    
    return NextResponse.json(users)
  } catch (error) {
    console.error('API Users Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
