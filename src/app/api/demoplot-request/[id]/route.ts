import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json(null, { status: 401 })

    const req = await prisma.request.findUnique({
      where: { id },
      include: {
        farmer: true,
        details: { include: { product: true } }
      }
    })
    return NextResponse.json(req)
  } catch {
    return NextResponse.json(null, { status: 500 })
  }
}
