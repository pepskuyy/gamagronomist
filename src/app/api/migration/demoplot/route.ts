import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export const maxDuration = 60

const prisma = new PrismaClient()

function parseDate(raw: string): Date | null {
  if (!raw?.trim()) return null
  try {
    const d = raw.trim()
    let parsed: Date
    if (d.includes('/')) {
      const [day, month, year] = d.split('/')
      parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    } else {
      parsed = new Date(d)
    }
    return isNaN(parsed.getTime()) ? null : parsed
  } catch { return null }
}

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

    // Pre-load all reference data upfront
    const farmers = await prisma.farmer.findMany({ select: { id: true, name: true } })
    const farmerMap = new Map(farmers.map(f => [f.name.toLowerCase().trim(), f.id]))

    const products = await prisma.product.findMany({ select: { id: true, name: true, code: true } })
    const productByName = new Map(products.map(p => [p.name.toLowerCase().trim(), p.id]))
    const productByCode = new Map(products.filter(p => p.code).map(p => [p.code!.toLowerCase().trim(), p.id]))

    const users = await prisma.user.findMany({ select: { id: true, username: true, areaId: true } })
    const userByUsername = new Map(users.map(u => [u.username.toLowerCase().trim(), u]))

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]
      const rowNum = idx + 2

      if (!r.date?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'Tanggal kosong.' }); skipped++; continue }
      if (!r.username_fo?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'username_fo kosong.' }); skipped++; continue }

      const parsedDate = parseDate(r.date)
      if (!parsedDate) {
        errors.push({ row: rowNum, name: r.farmerName || '-', reason: `Format tanggal "${r.date}" tidak valid. Gunakan DD/MM/YYYY atau YYYY-MM-DD.` }); skipped++; continue
      }

      const foUser = userByUsername.get(r.username_fo.trim().toLowerCase())
      if (!foUser) {
        errors.push({ row: rowNum, name: r.farmerName || '-', reason: `Username FO "${r.username_fo}" tidak ditemukan.` }); skipped++; continue
      }

      let farmerId = r.farmerName ? farmerMap.get(r.farmerName.trim().toLowerCase()) || null : null
      const lat = r.latitude ? parseFloat(r.latitude) : null
      const lng = r.longitude ? parseFloat(r.longitude) : null
      const isFinal = r.isFinalSession?.trim().toLowerCase()

      // Auto-create farmer if not found
      if (r.farmerName?.trim() && !farmerId) {
        try {
          const newFarmer = await prisma.farmer.create({
            data: { name: r.farmerName.trim(), area: r.area?.trim() || null }
          })
          farmerId = newFarmer.id
          farmerMap.set(r.farmerName.trim().toLowerCase(), newFarmer.id)
        } catch (e: any) {
          errors.push({ row: rowNum, name: r.farmerName, reason: `Gagal membuat petani: ${e.message}` }); skipped++; continue
        }
      }

      try {
        const req2 = await prisma.request.create({
          data: {
            createdAt: parsedDate,
            foId: foUser.id,
            farmerId,
            area: r.area?.trim() || null,
            commodity: r.commodity?.trim() || null,
            plan: 'Migrated Standalone Demo Plot',
            status: (isFinal === 'ya' || isFinal === 'true' || isFinal === '1' || isFinal === 'yes') ? 'DEMO_PLOT_SELESAI' : 'APPROVED',
          }
        })

        const dp = await prisma.demoPlot.create({
          data: {
            requestId: req2.id,
            date: parsedDate,
            area: r.area?.trim() || null,
            snapshotAreaId: foUser.areaId,
            commodity: r.commodity?.trim() || null,
            landSize: r.landSize ? parseFloat(r.landSize) || null : null,
            resultNotes: r.resultNotes?.trim() || null,
            farmerId,
            isFinalSession: req2.status === 'DEMO_PLOT_SELESAI',
            latitude: lat !== null && isNaN(lat) ? null : lat,
            longitude: lng !== null && isNaN(lng) ? null : lng,
          }
        })

        if (r.produk?.trim()) {
          const entries = r.produk.split(',').map((s: string) => s.trim()).filter(Boolean)
          for (const entry of entries) {
            const colonIdx = entry.lastIndexOf(':')
            let productKey: string
            let qty = 1
            if (colonIdx !== -1) {
              productKey = entry.slice(0, colonIdx).trim()
              qty = parseFloat(entry.slice(colonIdx + 1).trim()) || 1
            } else {
              productKey = entry.trim()
            }
            const productId = productByName.get(productKey.toLowerCase()) ?? productByCode.get(productKey.toLowerCase())
            if (productId) {
              await prisma.demoPlotDetail.create({
                data: { demoPlotId: dp.id, productId, actualUsage: qty }
              })
            }
          }
        }
        inserted++
      } catch (e: any) {
        errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'Gagal disimpan: ' + e.message }); skipped++
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
