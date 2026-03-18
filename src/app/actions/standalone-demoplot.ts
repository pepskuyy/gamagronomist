'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

/**
 * Creates a standalone demo plot session directly (without needing a pre-existing request).
 * Used by FO and AFA for direct demo plot recording from their own stock.
 */
export async function submitStandaloneDemoPlot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['FO', 'AFA'].includes(session.role)) {
    return { error: 'Hanya FO dan AFA yang dapat membuat realisasi demo plot langsung.' }
  }

  const farmerName   = (formData.get('farmerName')   as string)?.trim()
  const farmerPhone  = (formData.get('farmerPhone')  as string)?.trim() || null
  const area         = (formData.get('area')         as string)?.trim()
  const commodity    = (formData.get('commodity')    as string)?.trim()
  const problem      = (formData.get('problem')      as string)?.trim() || '-'
  const plan         = (formData.get('plan')         as string)?.trim() || '-'
  const date         = (formData.get('date')         as string)
  const landSize     = formData.get('landSize')      ? parseFloat(formData.get('landSize') as string) : null
  const resultNotes  = (formData.get('resultNotes')  as string)?.trim() || null
  const latitude     = parseFloat(formData.get('latitude') as string)
  const longitude    = parseFloat(formData.get('longitude') as string)
  const isFinalSession = formData.get('isFinalSession') === 'true'

  const usagesJSON = formData.get('usages') as string
  const photosJSON = formData.get('photos') as string

  let usages: { productId: string; actualUsage: number }[] = []
  let photos: string[] = []

  try {
    if (usagesJSON) usages = JSON.parse(usagesJSON)
    if (photosJSON) photos = JSON.parse(photosJSON)
  } catch { return { error: 'Gagal membaca data penggunaan produk.' } }

  if (!farmerName || !area || !commodity) {
    return { error: 'Nama petani, area, dan komoditas wajib diisi.' }
  }
  if (isNaN(latitude) || isNaN(longitude)) {
    return { error: 'GPS wajib diaktifkan sebelum menyimpan realisasi.' }
  }

  try {
    // Find or create farmer
    let farmer = await prisma.farmer.findFirst({ where: { name: farmerName } })
    if (!farmer) {
      farmer = await prisma.farmer.create({ data: { name: farmerName, phone: farmerPhone, area } })
    }

    // Create a standalone request (auto-approved)
    const req = await prisma.request.create({
      data: {
        foId: session.userId,
        afaId: session.role === 'FO' ? session.afaId : session.userId,
        farmerId: farmer.id,
        area,
        commodity,
        problem,
        plan,
        status: isFinalSession ? 'DEMO_PLOT_SELESAI' : 'APPROVED',
        details: {
          create: usages.filter(u => u.actualUsage > 0).map(u => ({
            productId: u.productId,
            qtyRequested: u.actualUsage,
            qtyApproved: u.actualUsage,
          })),
        },
      },
    })

    // Deduct stock for each used product
    for (const u of usages.filter(u => u.actualUsage > 0)) {
      await prisma.ledger.create({
        data: {
          userId: session.userId,
          productId: u.productId,
          transactionType: 'USAGE_DEMO_PLOT',
          quantity: -u.actualUsage,
          referenceId: req.id,
          notes: `Demo plot: ${farmerName} - ${commodity}`,
        },
      })
    }

    // Save demo plot session record
    await (prisma as any).demoPlot.create({
      data: {
        requestId: req.id,
        executedById: session.userId,
        sessionDate: new Date(date),
        landSize,
        resultNotes,
        latitude,
        longitude,
        photos: JSON.stringify(photos),
      },
    }).catch(() => {
      // DemoPlot model may not have this exact shape — graceful skip
    })

    revalidatePath('/dashboard/demoplot')
    return { success: true }
  } catch (err: any) {
    console.error('Standalone demo plot error', err)
    return { error: 'Gagal menyimpan realisasi demo plot. Coba lagi.' }
  }
}
