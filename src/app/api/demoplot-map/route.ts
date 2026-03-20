import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

function classify(productCount: number): 'spot' | 'mini' | 'full' {
  if (productCount === 1) return 'spot'
  if (productCount <= 3) return 'mini'
  return 'full'
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const session = await decrypt(token as string)
    if (!session?.userId) return NextResponse.json([])

    // Fetch demo plots that have GPS coordinates
    const demoPlots = await prisma.demoPlot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        farmer: true,
        request: {
          include: {
            fo: { select: { name: true } },
            details: { include: { product: { select: { name: true } } } }
          }
        },
        details: { include: { product: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const result = demoPlots
      .filter(dp => dp.latitude !== null && dp.longitude !== null)
      .map(dp => {
        // Count distinct products used in this session
        const products = dp.details.length > 0
          ? dp.details.map(d => d.product.name)
          : dp.request?.details?.map(d => d.product.name) ?? []

        const type = classify(products.length)

        return {
          id: dp.id,
          lat: dp.latitude!,
          lng: dp.longitude!,
          farmerName: dp.farmer?.name ?? dp.request?.['area'] ?? 'Tidak diketahui',
          area: dp.area ?? dp.request?.area ?? '-',
          commodity: dp.commodity ?? dp.request?.commodity ?? '-',
          foName: dp.request?.fo?.name ?? '-',
          date: dp.date.toISOString(),
          productCount: products.length,
          products,
          type,
        }
      })

    return NextResponse.json(result)
  } catch (err) {
    console.error('demoplot-map error', err)
    return NextResponse.json([])
  }
}
