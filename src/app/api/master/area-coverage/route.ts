import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { invalidateAreaCoverageCache } from '@/lib/area-resolver'


async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) return null
  return session
}

// GET /api/master/area-coverage?areaId=xxx
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  
  const areaId = new URL(req.url).searchParams.get('areaId')
  if (!areaId) {
    // Return all coverages grouped by area
    const all = await prisma.areaCoverage.findMany({ 
      include: { area: { select: { name: true } } },
      orderBy: [{ area: { name: 'asc' } }, { kabupatenName: 'asc' }]
    })
    return NextResponse.json(all)
  }
  
  const coverages = await prisma.areaCoverage.findMany({
    where: { areaId },
    orderBy: { kabupatenName: 'asc' }
  })
  return NextResponse.json(coverages)
}

// POST /api/master/area-coverage  { areaId, kabupatenName }
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  
  const body = await req.json()
  const { areaId, kabupatenName } = body
  if (!areaId || !kabupatenName?.trim()) {
    return NextResponse.json({ error: 'areaId dan kabupatenName wajib diisi' }, { status: 400 })
  }
  
  const normalized = kabupatenName.trim().toLowerCase()
  
  try {
    const coverage = await prisma.areaCoverage.create({
      data: { areaId, kabupatenName: normalized }
    })
    invalidateAreaCoverageCache()
    return NextResponse.json(coverage)
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Kabupaten/kota ini sudah ada di area tersebut.' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/master/area-coverage  { id }
export async function DELETE(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
  
  await prisma.areaCoverage.delete({ where: { id } })
  invalidateAreaCoverageCache()
  return NextResponse.json({ success: true })
}
