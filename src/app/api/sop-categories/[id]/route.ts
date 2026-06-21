import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const oldCat = await prisma.sopCategory.findUnique({ where: { id } })
    if (oldCat) {
      // update all SOPs that used the old category name
      await prisma.sop.updateMany({
        where: { category: oldCat.name },
        data: { category: name.trim() }
      })
    }
    
    const category = await prisma.sopCategory.update({
      where: { id },
      data: { name: name.trim() }
    })
    return NextResponse.json(category)
  } catch {
    return NextResponse.json({ error: 'Gagal mengubah kategori.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await prisma.sopCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus kategori.' }, { status: 400 })
  }
}
