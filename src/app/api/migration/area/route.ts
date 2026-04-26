import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export const maxDuration = 60

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Data kosong.' }, { status: 400 })
    }

    let inserted = 0, skipped = 0
    const errors: { row: number; name: string; reason: string }[] = []
    const existing = await prisma.area.findMany({ select: { name: true } })
    const existingNames = new Set(existing.map(a => a.name.toLowerCase().trim()))

    for (let idx = 0; idx < rows.length; idx++) {
      const name = rows[idx].name?.trim()
      if (!name) { errors.push({ row: idx + 2, name: '-', reason: 'Nama area kosong.' }); skipped++; continue }
      if (existingNames.has(name.toLowerCase())) { errors.push({ row: idx + 2, name, reason: 'Sudah ada.' }); skipped++; continue }
      try {
        await prisma.area.create({ data: { name } })
        existingNames.add(name.toLowerCase())
        inserted++
      } catch { errors.push({ row: idx + 2, name, reason: 'Gagal disimpan.' }); skipped++ }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
