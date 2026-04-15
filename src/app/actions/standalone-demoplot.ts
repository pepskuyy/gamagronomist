'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { resolveAreaIdFromCoords } from '@/lib/area-resolver'

const prisma = new PrismaClient()

/**
 * Creates a standalone demo plot session directly (without needing a pre-existing request).
 * Used by FO and AFA for direct demo plot recording from their own stock.
 */
export async function submitStandaloneDemoPlot(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['FO', 'AFA', 'INTERN'].includes(session.role)) {
    return { error: 'Hanya FO dan AFA yang dapat membuat realisasi demo plot langsung.' }
  }

  const farmerName      = (formData.get('farmerName')   as string)?.trim()
  const farmerPhone     = (formData.get('farmerPhone')  as string)?.trim() || null
  const area            = (formData.get('area')         as string)?.trim()
  const commodity       = (formData.get('commodity')    as string)?.trim()
  const problem         = (formData.get('problem')      as string)?.trim() || '-'
  const plan            = (formData.get('plan')         as string)?.trim() || '-'
  const date            = (formData.get('date')         as string)
  const landSize        = formData.get('landSize') ? parseFloat(formData.get('landSize') as string) : null
  const landSizeUnit    = (formData.get('landSizeUnit') as string) || 'ha'
  const resultNotes     = (formData.get('resultNotes')  as string)?.trim() || null
  const latitude        = parseFloat(formData.get('latitude') as string)
  const longitude       = parseFloat(formData.get('longitude') as string)
  const isFinalSession  = formData.get('isFinalSession') === 'true'

  const usagesJSON = formData.get('usages') as string
  const photosJSON = formData.get('photos') as string

  let usages: { productId: string; actualUsage: number; usedFarmerProduct?: boolean }[] = []
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
    // Resolve area: GPS-based mapping (Opsi B: GPS priority, fallback to user.areaId)
    const geoAreaId = (!isNaN(latitude) && !isNaN(longitude))
      ? await resolveAreaIdFromCoords(latitude, longitude)
      : null
    const resolvedAreaId = geoAreaId ?? session.areaId ?? null

    const req = await prisma.request.create({
      data: {
        foId: session.userId,
        afaId: session.role === 'AFA' ? session.userId : (session as any).afaId ?? null,
        farmerId: farmer.id,
        area,
        snapshotAreaId: resolvedAreaId,
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

    // Deduct stock — HANYA untuk produk milik user (bukan produk petani)
    for (const u of usages.filter(u => u.actualUsage > 0 && !u.usedFarmerProduct)) {
      await prisma.ledger.create({
          data: {
            userId: session.userId,
            productId: u.productId,
            transactionType: 'USAGE_DEMOPLOT',
            quantity: -u.actualUsage,
            referenceId: req.id,
            snapshotAreaId: session.areaId ?? null,
            notes: `Demo plot: ${farmerName} - ${commodity}`,
          },
      })
    }

    // ✅ Save demo plot session record with CORRECT field names from schema
    const demoPlot = await prisma.demoPlot.create({
      data: {
        requestId: req.id,
        farmerId: farmer.id,
        date: new Date(date),
        area,
        snapshotAreaId: session.areaId ?? null,
        commodity,
        landSize,
        landSizeUnit,
        resultNotes,
        latitude,
        longitude,
        isFinalSession,
        photos: JSON.stringify(photos),
      },
    })

    // ✅ Save DemoPlotDetail entries
    const validUsages = usages.filter(u => u.actualUsage > 0)
    if (validUsages.length > 0) {
      await prisma.demoPlotDetail.createMany({
        data: validUsages.map(u => ({
          demoPlotId: demoPlot.id,
          productId: u.productId,
          actualUsage: u.actualUsage,
          usedFarmerProduct: u.usedFarmerProduct ?? false,
        })),
      })
    }

    // Notify SPV/AFA
    if (session.role === 'FO' && session.afaId) {
      await prisma.notification.create({
        data: {
          userId: session.afaId,
          title: '📝 Realisasi Demo Plot',
          message: `${session.name} telah menyimpan realisasi demo plot untuk petani ${farmerName}.`,
          link: `/dashboard/demoplot/detail/${req.id}`
        }
      })
    } else if (session.role === 'AFA') {
      const afaUser = await prisma.user.findUnique({ where: { id: session.userId } })
      if (afaUser && afaUser.areaId) {
        const spvs = await prisma.user.findMany({ where: { role: 'SPV', areaId: afaUser.areaId } })
        for (const spv of spvs) {
          await prisma.notification.create({
            data: {
              userId: spv.id,
              title: '📝 Realisasi Demo Plot',
              message: `${session.name} (AFA) telah menyimpan realisasi demo plot untuk petani ${farmerName}.`,
              link: `/dashboard/demoplot/detail/${req.id}`
            }
          })
        }
      }
    }

    revalidatePath('/dashboard/demoplot')
    return { success: true, requestId: req.id }
  } catch (err: any) {
    console.error('Standalone demo plot error:', err)
    return { error: `Gagal menyimpan realisasi demo plot: ${err.message}` }
  }
}

/**
 * Continues an existing demo plot session (creates a new DemoPlot record linked to same Request).
 */
export async function submitContinueDemoPlot(requestId: string, formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId || !['FO', 'AFA', 'INTERN'].includes(session.role)) {
    return { error: 'Hanya FO dan AFA yang dapat menambah sesi demo plot.' }
  }

  const date           = (formData.get('date')        as string)
  const landSize       = formData.get('landSize') ? parseFloat(formData.get('landSize') as string) : null
  const landSizeUnit   = (formData.get('landSizeUnit') as string) || 'ha'
  const resultNotes    = (formData.get('resultNotes') as string)?.trim() || null
  const latitude       = parseFloat(formData.get('latitude') as string)
  const longitude      = parseFloat(formData.get('longitude') as string)
  const isFinalSession = formData.get('isFinalSession') === 'true'

  const usagesJSON = formData.get('usages') as string
  const photosJSON = formData.get('photos') as string
  let usages: { productId: string; actualUsage: number; usedFarmerProduct?: boolean }[] = []
  let photos: string[] = []
  try {
    if (usagesJSON) usages = JSON.parse(usagesJSON)
    if (photosJSON) photos = JSON.parse(photosJSON)
  } catch { return { error: 'Gagal membaca data.' } }

  if (isNaN(latitude) || isNaN(longitude)) {
    return { error: 'GPS wajib diaktifkan sebelum menyimpan sesi.' }
  }

  try {
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      include: { farmer: true }
    })
    if (!req) return { error: 'Data demo plot tidak ditemukan.' }

    // Create new DemoPlot session
    const demoPlot = await prisma.demoPlot.create({
      data: {
        requestId,
        farmerId: req.farmerId ?? undefined,
        date: new Date(date),
        area: req.area ?? undefined,
        snapshotAreaId: (req as any).snapshotAreaId ?? null,
        commodity: req.commodity ?? undefined,
        landSize,
        landSizeUnit,
        resultNotes,
        latitude,
        longitude,
        isFinalSession,
        photos: JSON.stringify(photos),
      },
    })

    // Save DemoPlotDetail entries
    const validUsages = usages.filter(u => u.actualUsage > 0)
    if (validUsages.length > 0) {
      await prisma.demoPlotDetail.createMany({
        data: validUsages.map(u => ({
          demoPlotId: demoPlot.id,
          productId: u.productId,
          actualUsage: u.actualUsage,
          usedFarmerProduct: u.usedFarmerProduct ?? false,
        })),
      })

      // Deduct stock — HANYA untuk produk milik user (bukan produk petani)
      for (const u of validUsages.filter(u => !u.usedFarmerProduct)) {
        await prisma.ledger.create({
          data: {
            userId: session.userId,
            productId: u.productId,
            transactionType: 'USAGE_DEMOPLOT',
            quantity: -u.actualUsage,
            referenceId: req.id,
            snapshotAreaId: (req as any).snapshotAreaId ?? null,
            notes: `Sesi lanjutan demo plot: ${req.farmer?.name ?? ''} - ${req.commodity ?? ''}`,
          },
        })
      }
    }

    // If final — mark request as done
    if (isFinalSession) {
      await prisma.request.update({
        where: { id: requestId },
        data: { status: 'DEMO_PLOT_SELESAI' }
      })
    }

    // Notify SPV/AFA
    if (session.role === 'FO' && session.afaId) {
      await prisma.notification.create({
        data: {
          userId: session.afaId,
          title: '📝 Update Sesi Demo Plot',
          message: `${session.name} telah menyimpan sesi lanjutan demo plot untuk petani ${req.farmer?.name ?? '-'}.`,
          link: `/dashboard/demoplot/detail/${req.id}`
        }
      })
    } else if (session.role === 'AFA') {
      const afaUser = await prisma.user.findUnique({ where: { id: session.userId } })
      if (afaUser && afaUser.areaId) {
        const spvs = await prisma.user.findMany({ where: { role: 'SPV', areaId: afaUser.areaId } })
        for (const spv of spvs) {
          await prisma.notification.create({
            data: {
              userId: spv.id,
              title: '📝 Update Sesi Demo Plot',
              message: `${session.name} (AFA) telah menyimpan sesi lanjutan demo plot untuk petani ${req.farmer?.name ?? '-'}.`,
              link: `/dashboard/demoplot/detail/${req.id}`
            }
          })
        }
      }
    }

    revalidatePath('/dashboard/demoplot')
    return { success: true }
  } catch (err: any) {
    console.error('Continue demo plot error:', err)
    return { error: `Gagal menyimpan sesi lanjutan: ${err.message}` }
  }
}
