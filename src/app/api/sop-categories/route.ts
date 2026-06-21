import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

export async function GET() {
  const categories = await prisma.sopCategory.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const category = await prisma.sopCategory.create({ data: { name: name.trim() } })
    return NextResponse.json(category)
  } catch {
    return NextResponse.json({ error: 'Kategori sudah ada atau terjadi kesalahan.' }, { status: 400 })
  }
}
