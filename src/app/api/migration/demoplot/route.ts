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

/**
 * Fuzzy product lookup: tries exact match first, then partial (startsWith / includes).
 * Returns the first matching product ID, or null.
 */
function findProductId(
  key: string,
  productByName: Map<string, string>,
  productByCode: Map<string, string>,
  allProducts: { id: string; name: string; code: string | null }[]
): string | null {
  const k = key.toLowerCase().trim()
  // 1. Exact match by name
  if (productByName.has(k)) return productByName.get(k)!
  // 2. Exact match by code
  if (productByCode.has(k)) return productByCode.get(k)!
  // 3. Partial match: product name starts with the key
  const startsWithMatch = allProducts.find(p => p.name.toLowerCase().startsWith(k))
  if (startsWithMatch) return startsWithMatch.id
  // 4. Partial match: key starts with product name (e.g., "Biogent 30" matches "Biogent")
  const reverseMatch = allProducts.find(p => k.startsWith(p.name.toLowerCase()))
  if (reverseMatch) return reverseMatch.id
  // 5. Contains match (least specific)
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
    const farmers = await prisma.farmer.findMany({ select: { id: true, name: true } })
    const farmerMap = new Map(farmers.map(f => [f.name.toLowerCase().trim(), f.id]))

    const allProducts = await prisma.product.findMany({ select: { id: true, name: true, code: true } })
    const productByName = new Map(allProducts.map(p => [p.name.toLowerCase().trim(), p.id]))
    const productByCode = new Map(allProducts.filter(p => p.code).map(p => [p.code!.toLowerCase().trim(), p.id]))

    const users = await prisma.user.findMany({ select: { id: true, username: true, areaId: true } })
    const userByUsername = new Map(users.map(u => [u.username.toLowerCase().trim(), u]))

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]
      const rowNum = idx + 2

      if (!r.date?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'Tanggal kosong.' }); skipped++; continue }
      if (!r.username_fo?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'username_fo kosong.' }); skipped++; continue }

      const parsedDate = parseDate(r.date)
      if (!parsedDate) {
        errors.push({ row: rowNum, name: r.farmerName || '-', reason: `Format tanggal "${r.date}" tidak valid.` }); skipped++; continue
      }

      const foUser = userByUsername.get(r.username_fo.trim().toLowerCase())
      if (!foUser) {
        errors.push({ row: rowNum, name: r.farmerName || '-', reason: `Username FO "${r.username_fo}" tidak ditemukan.` }); skipped++; continue
      }

      // In repair mode: find existing migrated DemoPlot and add missing products
      if (repairMode) {
        try {
          // Find a matching migrated demo plot
          const dateStart = new Date(parsedDate)
          dateStart.setHours(0, 0, 0, 0)
          const dateEnd = new Date(parsedDate)
          dateEnd.setHours(23, 59, 59, 999)

          const existingDPs = await prisma.demoPlot.findMany({
            where: {
              date: { gte: dateStart, lte: dateEnd },
              request: {
                foId: foUser.id,
                plan: 'Migrated Standalone Demo Plot',
              },
              ...(r.farmerName?.trim() ? {
                farmer: { name: { equals: r.farmerName.trim(), mode: 'insensitive' as const } }
              } : {}),
            },
            include: { details: true },
          })

          if (existingDPs.length > 0) {
            const dp = existingDPs[0]
            // Only repair if no details exist yet
            if (dp.details.length === 0 && r.produk?.trim()) {
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
                  await prisma.demoPlotDetail.create({
                    data: { demoPlotId: dp.id, productId, actualUsage: qty }
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

      // Normal import: create new DemoPlot
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

        // Parse products with fuzzy matching
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

    return NextResponse.json({ success: true, inserted, skipped, repaired, errors })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (err.message || 'Unknown') }, { status: 500 })
  }
}
