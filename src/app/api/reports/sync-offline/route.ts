import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { resolveAreaIdFromCoords } from '@/lib/area-resolver'

const prisma = new PrismaClient()

/**
 * POST /api/reports/sync-offline
 * Dipanggil oleh Service Worker saat koneksi pulih.
 * Menerima JSON payload dengan field `type` untuk menentukan jenis laporan.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, photos: photosJson, _offlineDraftId, ...formFields } = body

    if (!type) {
      return NextResponse.json({ error: 'Missing type field' }, { status: 400 })
    }

    let photos: string[] = []
    if (photosJson) {
      try {
        photos = typeof photosJson === 'string' ? JSON.parse(photosJson) : photosJson
      } catch { photos = [] }
    }

    // ── Spot Demplot ─────────────────────────────────────────────────
    if (type === 'spot-demplot') {
      const latitude = parseFloat(formFields.latitude)
      const longitude = parseFloat(formFields.longitude)

      const geoAreaId = (!isNaN(latitude) && !isNaN(longitude))
        ? await resolveAreaIdFromCoords(latitude, longitude)
        : null

      let usages: { productId: string; actualUsage: number; usedFarmerProduct?: boolean }[] = []
      try {
        if (formFields.usages) usages = JSON.parse(formFields.usages)
      } catch { usages = [] }

      const spotDemplot = await prisma.spotDemplot.create({
        data: {
          userId: session.userId,
          districtDesa: formFields.districtDesa || null,
          districtKec: formFields.districtKecamatan || null,
          districtKab: formFields.district || null,
          weeds: formFields.weeds || null,
          date: new Date(formFields.date || Date.now()),
          observationResult: formFields.observationResult || null,
          latitude: isNaN(latitude) ? null : latitude,
          longitude: isNaN(longitude) ? null : longitude,
          snapshotAreaId: geoAreaId ?? session.areaId ?? null,
          photos: JSON.stringify(photos),
        },
      })

      const validUsages = usages.filter(u => u.actualUsage > 0)
      if (validUsages.length > 0) {
        await prisma.spotDemplotDetail.createMany({
          data: validUsages.map(u => ({
            spotDemplotId: spotDemplot.id,
            productId: u.productId,
            usage: u.actualUsage,
            usedFarmerProduct: u.usedFarmerProduct ?? false,
          })),
        })
        const ownStockUsages = validUsages.filter(u => !u.usedFarmerProduct)
        for (const u of ownStockUsages) {
          await prisma.ledger.create({
            data: {
              userId: session.userId,
              productId: u.productId,
              transactionType: 'USAGE_SPOT_DEMOPLOT',
              quantity: -u.actualUsage,
              referenceId: spotDemplot.id,
              snapshotAreaId: session.areaId ?? null,
              notes: `Spot Demplot Offline: ${formFields.districtDesa || ''} - ${formFields.districtKecamatan || ''}`,
            },
          })
        }
      }

      return NextResponse.json({ success: true, id: spotDemplot.id, type })
    }

    // ── Customer Behavior ─────────────────────────────────────────────
    if (type === 'cb') {
      const lat = parseFloat(formFields.latitude)
      const lng = parseFloat(formFields.longitude)

      const geoAreaId = (!isNaN(lat) && !isNaN(lng))
        ? await resolveAreaIdFromCoords(lat, lng)
        : null

      const report = await prisma.customerBehavior.create({
        data: {
          userId: session.userId,
          snapshotAreaId: geoAreaId ?? session.areaId ?? null,
          farmerName: formFields.farmerName || '',
          age: formFields.age || null,
          phone: formFields.phone || null,
          address: formFields.address || null,
          district: formFields.district || null,
          commodity: formFields.commodity || null,
          reasonChoice: formFields.reasonChoice || null,
          constraints: formFields.constraints || null,
          optTypes: formFields.optTypes || null,
          optDetails: formFields.optDetails || null,
          usedProducts: formFields.usedProducts || null,
          buyLocation: formFields.buyLocation || null,
          buyReason: formFields.buyReason || null,
          references: formFields.references || null,
          notes: formFields.notes || null,
          photos: JSON.stringify(photos),
          totalLandArea: formFields.totalLandArea ? parseFloat(formFields.totalLandArea) : null,
          totalLandAreaUnit: formFields.totalLandAreaUnit || 'ha',
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
        },
      })

      return NextResponse.json({ success: true, id: report.id, type })
    }

    return NextResponse.json({ error: `Unsupported type: ${type}` }, { status: 400 })

  } catch (err: any) {
    console.error('[sync-offline] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/reports/sync-offline
 * Dipanggil dari browser tab untuk trigger sync manual
 * (fallback iOS Safari yang tidak support Background Sync API)
 */
export async function PUT(req: NextRequest) {
  // Kembalikan 200 — trigger sync sesungguhnya dilakukan dari client via postMessage
  return NextResponse.json({ ok: true })
}
