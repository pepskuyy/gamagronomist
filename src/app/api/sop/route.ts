import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

// GET — list all published SOPs (all roles can read)
export async function GET() {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sops = await prisma.sop.findMany({
    where: { isPublished: true },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json(sops)
}

// POST — create new SOP (only AFA, SPV, ADMIN)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk membuat SOP.' }, { status: 403 })
  }

  const { title, fileUrl, fileName, category } = await req.json()
  if (!title?.trim() || !fileUrl?.trim() || !category?.trim()) {
    return NextResponse.json({ error: 'Judul, file PDF, dan kategori wajib diisi.' }, { status: 400 })
  }

  const sop = await prisma.sop.create({
    data: {
      title: title.trim(),
      fileUrl: fileUrl.trim(),
      fileName: fileName?.trim() || null,
      category: category.trim(),
      authorId: session.userId,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json(sop, { status: 201 })
}
