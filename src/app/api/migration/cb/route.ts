import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

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
    let farmersCreated = 0
    const errors: { row: number; name: string; reason: string }[] = []

    // Pre-load reference data
    const users = await prisma.user.findMany({ select: { id: true, username: true } })
    const userMap = new Map(users.map(u => [u.username.toLowerCase().trim(), u.id]))

    const existingFarmers = await prisma.farmer.findMany({ select: { name: true } })
    const farmerKeys = new Set(existingFarmers.map(f => f.name.toLowerCase().trim()))

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]
      const rowNum = idx + 2
      if (!r.username?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'username_pelapor kosong.' }); skipped++; continue }
      if (!r.farmerName?.trim()) { errors.push({ row: rowNum, name: '-', reason: 'nama_petani kosong.' }); skipped++; continue }
      const userId = userMap.get(r.username.trim().toLowerCase())
      if (!userId) { errors.push({ row: rowNum, name: r.farmerName, reason: `User "${r.username}" tidak ditemukan.` }); skipped++; continue }

      const parts = [r.desa, r.kecamatan, r.kabupaten].filter((p: any) => p?.trim()).map((p: any) => p!.trim())
      const address = parts.length > 0 ? parts.join(', ') : null

      let parsedDate: Date | undefined
      if (r.tanggal?.trim()) {
        try {
          const d = r.tanggal.trim()
          if (/^\d+$/.test(d)) {
            const excelDays = parseInt(d, 10)
            parsedDate = new Date(Math.round((excelDays - 25569) * 86400 * 1000))
          } else if (d.includes('/')) {
            const [day, month, year] = d.split('/')
            parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
          } else {
            parsedDate = new Date(d)
          }
          if (isNaN(parsedDate.getTime())) parsedDate = undefined
        } catch { parsedDate = undefined }
      }

      try {
        const farmerName = r.farmerName.trim()
        if (!farmerKeys.has(farmerName.toLowerCase())) {
          await prisma.farmer.create({
            data: { name: farmerName, phone: r.phone?.trim() || null, address, area: r.kabupaten?.trim() || null }
          })
          farmerKeys.add(farmerName.toLowerCase())
          farmersCreated++
        }

        await prisma.customerBehavior.create({
          data: {
            ...(parsedDate ? { createdAt: parsedDate } : {}),
            userId,
            farmerName,
            age: r.age?.trim() || null,
            phone: r.phone?.trim() || null,
            address,
            district: r.kecamatan?.trim() || null,
            commodity: r.commodity?.trim() || null,
            reasonChoice: r.reasonChoice?.trim() || null,
            constraints: r.constraints?.trim() || null,
            optTypes: r.optTypes?.trim() || null,
            optDetails: r.optDetails?.trim() || null,
            usedProducts: r.usedProducts?.trim() || null,
            buyLocation: r.buyLocation?.trim() || null,
            buyReason: r.buyReason?.trim() || null,
            references: r.references?.trim() || null,
            notes: r.notes?.trim() || null,
          }
        })
        inserted++
      } catch (e: any) {
        errors.push({ row: rowNum, name: r.farmerName, reason: 'Gagal disimpan: ' + e.message }); skipped++
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors, farmersCreated })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
