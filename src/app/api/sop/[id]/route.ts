import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

// PUT — update SOP
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengubah SOP.' }, { status: 403 })
  }

  const { id } = await params
  const { title, content, category } = await req.json()
  if (!title?.trim() || !content?.trim() || !category?.trim()) {
    return NextResponse.json({ error: 'Judul, konten, dan kategori wajib diisi.' }, { status: 400 })
  }

  const sop = await prisma.sop.update({
    where: { id },
    data: { title: title.trim(), content: content.trim(), category: category.trim() },
    include: { author: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json(sop)
}

// DELETE — delete SOP
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus SOP.' }, { status: 403 })
  }

  const { id } = await params
  await prisma.sop.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
