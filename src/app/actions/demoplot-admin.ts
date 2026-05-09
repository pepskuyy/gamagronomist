'use server'

import prisma from '@/lib/prisma'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'


async function getAdminSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}

export async function deleteDemoPlot(id: string) {
  try {
    await getAdminSession()

    // Find the DemoPlot first to see if it's attached to a standalone/mock request
    const dp = await prisma.demoPlot.findUnique({
      where: { id },
      include: { request: true }
    })

    if (!dp) return { error: 'Demo Plot tidak ditemukan' }

    // Delete the DemoPlot (Prisma cascades to DemoPlotDetail automatically)
    await prisma.demoPlot.delete({ where: { id } })

    // If it was a mock request specifically for migrated standalone demo plots, clean it up
    if (dp.requestId && dp.request?.plan === 'Migrated Standalone Demo Plot') {
      try {
        await prisma.request.delete({ where: { id: dp.requestId } })
      } catch (err) {
        console.warn('Failed to clean up orphaned request:', err)
      }
    } else if (dp.requestId && dp.isFinalSession) {
      // If it was a real request, deleting the demo plot means it's no longer 'DEMO_PLOT_SELESAI'
      // Revert status to APPROVED if it had one.
      await prisma.request.update({
        where: { id: dp.requestId },
        data: { status: 'APPROVED' }
      })
    }

    revalidatePath('/dashboard/reports')
    return { success: true }
  } catch (err: any) {
    console.error('Delete Demo Plot Error:', err)
    return { error: 'Gagal menghapus laporan Demo Plot.' }
  }
}

export async function updateDemoPlot(id: string, formData: FormData) {
  try {
    await getAdminSession()

    const rawDate = formData.get('date') as string
    const parsedDate = new Date(rawDate)

    const isFinalSessionStr = formData.get('isFinalSession') as string
    const isFinalSession = isFinalSessionStr === 'on' || isFinalSessionStr === 'true'

    const data = {
      date: isNaN(parsedDate.getTime()) ? undefined : parsedDate,
      area: formData.get('area') as string,
      commodity: formData.get('commodity') as string,
      landSize: parseFloat(formData.get('landSize') as string) || null,
      landSizeUnit: (formData.get('landSizeUnit') as string) || 'ha',
      resultNotes: formData.get('resultNotes') as string,
      isFinalSession,
    }

    const updatedDp = await prisma.demoPlot.update({
      where: { id },
      data,
      include: { request: true }
    })

    // If the final session status changed, sync it up with the request status
    if (updatedDp.requestId) {
      if (isFinalSession && updatedDp.request?.status !== 'DEMO_PLOT_SELESAI') {
        await prisma.request.update({ where: { id: updatedDp.requestId }, data: { status: 'DEMO_PLOT_SELESAI' } })
      } else if (!isFinalSession && updatedDp.request?.status === 'DEMO_PLOT_SELESAI') {
        await prisma.request.update({ where: { id: updatedDp.requestId }, data: { status: 'APPROVED' } })
      }
    }
    
    revalidatePath('/dashboard/reports')
    revalidatePath(`/dashboard/reports/demoplot/${id}`)
    return { success: true }
  } catch (err: any) {
    console.error('Update Demo Plot Error:', err)
    return { error: 'Gagal mengupdate laporan Demo Plot.' }
  }
}

export async function bulkDeleteDemoPlots(ids: string[]) {
  if (!ids.length) return { error: 'Tidak ada data yang dipilih.' }
  try {
    await getAdminSession()
    // Collect all the requestIds before deleting
    const plots = await prisma.demoPlot.findMany({
      where: { id: { in: ids } },
      select: { id: true, requestId: true, request: { select: { plan: true } } }
    })
    await prisma.demoPlot.deleteMany({ where: { id: { in: ids } } })
    // Clean up any mock requests left behind
    const mockRequestIds = plots
      .filter(p => p.requestId && p.request?.plan === 'Migrated Standalone Demo Plot')
      .map(p => p.requestId!)
    if (mockRequestIds.length) {
      await prisma.request.deleteMany({ where: { id: { in: mockRequestIds } } })
    }
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard/demoplot')
    return { success: true }
  } catch (err: any) {
    console.error('Bulk Delete Demo Plot Error:', err)
    return { error: 'Gagal menghapus data Demo Plot.' }
  }
}
