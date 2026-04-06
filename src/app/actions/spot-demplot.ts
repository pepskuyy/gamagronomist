'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

  let usages: { productId: string; actualUsage: number }[] = []
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
        photos: JSON.stringify(photos),
      },
    })

    const validUsages = usages.filter(u => u.actualUsage > 0)
    
    // 2. Save usages & deduct stock
    if (validUsages.length > 0) {
      // Save details records
      await prisma.spotDemplotDetail.createMany({
        data: validUsages.map(u => ({
          spotDemplotId: spotDemplot.id,
          productId: u.productId,
          usage: u.actualUsage,
        })),
      })

      // Deduct stock via Ledger
      for (const u of validUsages) {
        await prisma.ledger.create({
          data: {
            userId: session.userId,
            productId: u.productId,
            transactionType: 'USAGE_SPOT_DEMOPLOT',
            quantity: -u.actualUsage,
            referenceId: spotDemplot.id,
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
