'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function submitDemoPlotSession(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) return { error: 'Unauthorized' }

  const requestId = formData.get('requestId') as string
  const date = formData.get('date') as string
  const landSize = Number(formData.get('landSize'))
  const resultNotes = formData.get('resultNotes') as string
  const isFinalSession = formData.get('isFinalSession') === 'true'
  const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null
  const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null
  const photos = formData.get('photos') as string || null

  if (!requestId || !date) return { error: 'Data tidak lengkap' }

  // Array of actual usages
  const usageJSON = formData.get('usages') as string
  let usages: { productId: string, actualUsage: number }[] = []
  
  try {
    if (usageJSON) usages = JSON.parse(usageJSON)
  } catch (e) {
    return { error: 'Gagal membaca data penggunan produk.' }
  }

  // Filter 0 usage out if any
  usages = usages.filter(u => u.actualUsage > 0)

  try {
    const request = await prisma.request.findUnique({ where: { id: requestId } })
    if (!request || request.status !== 'APPROVED') {
       return { error: 'Pengajuan tidak berada dalam status APPROVED' }
    }

    const transactionType = (session.role === 'FO' || session.role === 'INTERN') ? 'USAGE_DEMOPLOT' : 'DIRECT_USAGE_AFA'

    // Gunakan transaksi untuk memastikan ledger dan demo plot tersimpan sekaligus
    await prisma.$transaction(async (tx) => {
      // 1. Buat Header Demo Plot
      const demoPlot = await tx.demoPlot.create({
        data: {
          requestId,
          farmerId: request.farmerId,
          date: new Date(date),
          area: request.area,
          commodity: request.commodity,
          landSize: landSize || null,
          resultNotes,
          latitude,
          longitude,
          photos,
          isFinalSession,
          details: {
            create: usages.map(u => ({
              productId: u.productId,
              actualUsage: u.actualUsage
            }))
          }
        }
      })

      // 2. Buat Ledger Pengeluaran per Produk
      for (const u of usages) {
        await tx.ledger.create({
          data: {
            userId: session.userId,
            productId: u.productId,
            transactionType: transactionType,
            quantity: -u.actualUsage, // Potong stok
            referenceId: demoPlot.id,
            notes: `Realisasi Demo Plot Request ${request.id.slice(0, 8)}`
          }
        })
      }

      // 3. Update Request Status if it's final
      if (isFinalSession) {
         await tx.request.update({
           where: { id: requestId },
           data: { status: 'DEMO_PLOT_SELESAI' }
         })
      }
    })

    revalidatePath('/dashboard/demoplot')
    return { success: true }
  } catch (err: any) {
    console.error('Demo Plot Execution Error:', err)
    return { error: 'Terjadi kesalahan sistem saat merekam aktivitas.' }
  }
}
