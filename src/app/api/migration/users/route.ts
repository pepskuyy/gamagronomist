import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// Allow up to 60 seconds for this route (Vercel Pro) or 10s (Hobby)
export const maxDuration = 60


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

    const areas = await prisma.area.findMany({ select: { id: true, name: true } })
    const areaMap = new Map(areas.map(a => [a.name.toLowerCase().trim(), a.id]))

    const afas = await prisma.user.findMany({ where: { role: { in: ['AFA', 'PLANTATION'] } }, select: { id: true, name: true } })
    const afaMap = new Map(afas.map(a => [a.name.toLowerCase().trim(), a.id]))

    const existingUsernames = new Set(
      (await prisma.user.findMany({ select: { username: true } })).map(u => u.username.toLowerCase())
    )
    const VALID_ROLES = ['ADMIN', 'SPV', 'AFA', 'PLANTATION', 'FO', 'INTERN']

    // Pre-hash all passwords in parallel
    const validItems: { idx: number; r: any; role: string; areaId: string | null; afaId: string | null; isActive: boolean }[] = []
    const hashPromises: Promise<string>[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowNum = i + 2
      if (!r.username?.trim() || !r.name?.trim() || !r.password?.trim() || !r.role?.trim()) {
        errors.push({ row: rowNum, name: r.name || '-', reason: 'username, password, nama, dan role wajib diisi.' }); skipped++; continue
      }
      const role = r.role.trim().toUpperCase()
      if (!VALID_ROLES.includes(role)) {
        errors.push({ row: rowNum, name: r.name, reason: `Role "${r.role}" tidak valid.` }); skipped++; continue
      }
      if (existingUsernames.has(r.username.trim().toLowerCase())) {
        errors.push({ row: rowNum, name: r.name, reason: 'Username sudah terdaftar.' }); skipped++; continue
      }

      const areaId = r.areaName ? areaMap.get(r.areaName.trim().toLowerCase()) || null : null
      const afaId = r.afaName && (role === 'FO' || role === 'INTERN') ? afaMap.get(r.afaName.trim().toLowerCase()) || null : null
      const isActive = r.status ? !['nonaktif', 'inactive', 'false', '0', 'tidak'].includes(r.status.trim().toLowerCase()) : true

      validItems.push({ idx: validItems.length, r, role, areaId, afaId, isActive })
      hashPromises.push(bcrypt.hash(r.password.trim(), 6))
      existingUsernames.add(r.username.trim().toLowerCase())
    }

    const hashes = await Promise.all(hashPromises)

    // Insert one by one
    for (let i = 0; i < validItems.length; i++) {
      const { r, role, areaId, afaId, isActive } = validItems[i]
      try {
        const user = await prisma.user.create({
          data: {
            username: r.username.trim(),
            password: hashes[i],
            name: r.name.trim(),
            role,
            areaId,
            afaId,
            isActive,
          }
        })
        if (['AFA', 'PLANTATION'].includes(role)) afaMap.set(r.name.trim().toLowerCase(), user.id)
        inserted++
      } catch (e: any) {
        errors.push({ row: validItems[i].r.rowNum || i + 2, name: r.name, reason: e?.code === 'P2002' ? 'Username duplikat.' : 'Gagal disimpan.' })
        skipped++
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors })
  } catch (err: any) {
    console.error('User import route error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
