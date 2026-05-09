import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export const maxDuration = 60


function parseDate(raw: string): Date | null {
  if (!raw?.trim()) return null
  try {
    const d = raw.trim()
    let parsed: Date
    if (/^\d+$/.test(d)) {
      // Excel serial date (days since Jan 1, 1900)
      const excelDays = parseInt(d, 10)
      parsed = new Date(Math.round((excelDays - 25569) * 86400 * 1000))
    } else if (d.includes('/')) {
      const [day, month, year] = d.split('/')
      parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    } else {
      parsed = new Date(d)
    }
    return isNaN(parsed.getTime()) ? null : parsed
  } catch { return null }
}

function findProductId(
  key: string,
  productByName: Map<string, string>,
  productByCode: Map<string, string>,
  allProducts: { id: string; name: string; code: string | null }[]
): string | null {
  const k = key.toLowerCase().trim()
  if (productByName.has(k)) return productByName.get(k)!
  if (productByCode.has(k)) return productByCode.get(k)!
  const startsWithMatch = allProducts.find(p => p.name.toLowerCase().startsWith(k))
  if (startsWithMatch) return startsWithMatch.id
  const reverseMatch = allProducts.find(p => k.startsWith(p.name.toLowerCase()))
  if (reverseMatch) return reverseMatch.id
  const containsMatch = allProducts.find(p => p.name.toLowerCase().includes(k) || k.includes(p.name.toLowerCase()))
  if (containsMatch) return containsMatch.id
  return null
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = await decrypt(cookieStore.get('session')?.value as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const { rows, repairMode } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Data kosong.' }, { status: 400 })
    }

    let inserted = 0, skipped = 0, repaired = 0
    const errors: { row: number; name: string; reason: string }[] = []

    // Pre-load all reference data upfront
    const allProducts = await prisma.product.findMany({ select: { id: true, name: true, code: true } })
    const productByName = new Map(allProducts.map(p => [p.name.toLowerCase().trim(), p.id]))
    const productByCode = new Map(allProducts.filter(p => p.code).map(p => [p.code!.toLowerCase().trim(), p.id]))

    const users = await prisma.user.findMany({ select: { id: true, username: true, areaId: true } })
    const userByUsername = new Map(users.map(u => [u.username.toLowerCase().trim(), u]))

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]
      const rowNum = idx + 2

      if (!r.date?.trim()) { errors.push({ row: rowNum, name: '-', reason: 'Tanggal kosong.' }); skipped++; continue }
      if (!r.username_fo?.trim()) { errors.push({ row: rowNum, name: '-', reason: 'username_fo kosong.' }); skipped++; continue }

      const parsedDate = parseDate(r.date)
      if (!parsedDate) {
        errors.push({ row: rowNum, name: r.username_fo, reason: `Format tanggal "${r.date}" tidak valid.` }); skipped++; continue
      }

      const foUser = userByUsername.get(r.username_fo.trim().toLowerCase())
      if (!foUser) {
        errors.push({ row: rowNum, name: r.username_fo, reason: `Username FO "${r.username_fo}" tidak ditemukan.` }); skipped++; continue
      }

      // In repair mode: find existing SpotDemplot and add missing products
      if (repairMode) {
        try {
          const dateStart = new Date(parsedDate)
          dateStart.setHours(0, 0, 0, 0)
          const dateEnd = new Date(parsedDate)
          dateEnd.setHours(23, 59, 59, 999)

          const existingSPs = await prisma.spotDemplot.findMany({
            where: {
              date: { gte: dateStart, lte: dateEnd },
              userId: foUser.id,
              ...(r.desa?.trim() ? {
                districtDesa: { equals: r.desa.trim(), mode: 'insensitive' as const }
              } : {}),
            },
            include: { details: true },
          })

          if (existingSPs.length > 0) {
            const sp = existingSPs[0]
            // Only repair if no details exist yet
            if (sp.details.length === 0 && r.produk?.trim()) {
              const entries = r.produk.split(',').map((s: string) => s.trim()).filter(Boolean)
              let productsAdded = 0
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
                const productId = findProductId(productKey, productByName, productByCode, allProducts)
                if (productId) {
                  await prisma.spotDemplotDetail.create({
                    data: { spotDemplotId: sp.id, productId, usage: qty }
                  })
                  productsAdded++
                }
              }
              if (productsAdded > 0) repaired++
              else skipped++
            } else {
              skipped++ // Already has products or no product data
            }
            continue
          }
          // If not found in repair mode, fall through to create new
        } catch {
          // If repair fails, fall through to create new
        }
      }

      // Normal import: create new SpotDemplot
      const lat = r.latitude ? parseFloat(r.latitude) : null
      const lng = r.longitude ? parseFloat(r.longitude) : null

      try {
        const dp = await prisma.spotDemplot.create({
          data: {
            userId: foUser.id,
            snapshotAreaId: foUser.areaId,
            date: parsedDate,
            districtKab: r.kabupaten?.trim() || null,
            districtKec: r.kecamatan?.trim() || null,
            districtDesa: r.desa?.trim() || null,
            weeds: r.weeds?.trim() || null,
            observationResult: r.observationResult?.trim() || null,
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
            const productId = findProductId(productKey, productByName, productByCode, allProducts)
            if (productId) {
              await prisma.spotDemplotDetail.create({
                data: { spotDemplotId: dp.id, productId, usage: qty }
              })
            }
          }
        }
        inserted++
      } catch (e: any) {
        errors.push({ row: rowNum, name: r.username_fo, reason: 'Gagal disimpan: ' + e.message }); skipped++
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, repaired, errors })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
