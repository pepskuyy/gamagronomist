'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { resolveAreaIdFromCoords } from '@/lib/area-resolver'


/**
 * Creates a Spot Demplot record.
 * Deducts used products from the user's ledger (stock).
 */
export async function submitSpotDemplot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) {
    return { error: 'Unauthorized.' }
  }

  const districtDesa = (formData.get('districtDesa') as string)?.trim() || null
  const districtKec = (formData.get('districtKecamatan') as string)?.trim() || null
  const districtKab = (formData.get('district') as string)?.trim() || null
  const weeds = (formData.get('weeds') as string)?.trim() || null
  const date = formData.get('date') as string
  const observationResult = (formData.get('observationResult') as string)?.trim() || null
  const latitude = parseFloat(formData.get('latitude') as string)
  const longitude = parseFloat(formData.get('longitude') as string)

  const usagesJSON = formData.get('usages') as string
  const photosJSON = formData.get('photos') as string

  let usages: { productId: string; actualUsage: number; usedFarmerProduct?: boolean }[] = []
  let photos: string[] = []

  try {
    if (usagesJSON) usages = JSON.parse(usagesJSON)
    if (photosJSON) photos = JSON.parse(photosJSON)
  } catch {
    return { error: 'Gagal membaca data form.' }
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return { error: 'GPS wajib diaktifkan sebelum menyimpan laporan.' }
  }

  try {
    // Resolve area: GPS-based (Opsi B: GPS priority, fallback user.areaId)
    const geoAreaId = (!isNaN(latitude) && !isNaN(longitude))
      ? await resolveAreaIdFromCoords(latitude, longitude)
      : null
    const resolvedAreaId = geoAreaId ?? session.areaId ?? null

    // 1. Create SpotDemplot record
    const spotDemplot = await prisma.spotDemplot.create({
      data: {
        userId: session.userId,
        districtDesa,
        districtKec,
        districtKab,
        weeds,
        date: new Date(date),
        observationResult,
        latitude,
        longitude,
        snapshotAreaId: resolvedAreaId,
        photos: JSON.stringify(photos),
      },
    })

    const validUsages = usages.filter(u => u.actualUsage > 0)
    
    // 2. Save detail records (semua, termasuk produk petani)
    if (validUsages.length > 0) {
      await prisma.spotDemplotDetail.createMany({
        data: validUsages.map(u => ({
          spotDemplotId: spotDemplot.id,
          productId: u.productId,
          usage: u.actualUsage,
          usedFarmerProduct: u.usedFarmerProduct ?? false,
        })),
      })

      // Deduct stock via Ledger — HANYA untuk produk milik user (bukan produk petani)
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
            notes: `Spot Demplot: ${districtDesa || ''} - ${districtKec || ''}`,
          },
        })
      }
    }

    return { success: true, id: spotDemplot.id }
  } catch (err: any) {
    console.error('Submit Spot Demplot Error:', err)
    return { error: 'Gagal menyimpan data Spot Demplot.' }
  }
}

export async function deleteSpotDemplot(id: string) {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!session?.userId || session.role !== 'ADMIN') {
    return { error: 'Tidak memiliki akses.' }
  }

  try {
    await prisma.spotDemplot.delete({ where: { id } })
    return { success: true }
  } catch (err: any) {
    console.error('Delete Spot Demplot Error:', err)
    return { error: 'Gagal menghapus data.' }
  }
}
