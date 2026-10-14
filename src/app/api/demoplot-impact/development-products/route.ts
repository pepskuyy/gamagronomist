import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface DevelopmentProduct {
  id: string
  name: string
  code?: string | null
  targetCrop?: string | null
  notes?: string | null
  isActive: boolean
  createdAt?: string
}

const CONFIG_KEY = 'demoplot_development_products'

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    })

    let products: DevelopmentProduct[] = []
    if (config?.value) {
      try {
        products = JSON.parse(config.value)
      } catch (e) {
        console.warn('Failed to parse demoplot_development_products json:', e)
        products = []
      }
    }

    return NextResponse.json({
      success: true,
      products,
    })
  } catch (err: any) {
    console.error('[API development-products GET] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal memuat produk pengembangan.' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { products } = body

    if (!Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Format data tidak valid. Wajib berupa array produk.' },
        { status: 400 }
      )
    }

    // Sanitasi dan format data
    const sanitized: DevelopmentProduct[] = products.map((p: any) => ({
      id: String(p.id || ''),
      name: String(p.name || '').trim(),
      code: p.code ? String(p.code).trim() : null,
      targetCrop: p.targetCrop ? String(p.targetCrop).trim() : null,
      notes: p.notes ? String(p.notes).trim() : null,
      isActive: p.isActive !== false,
      createdAt: p.createdAt || new Date().toISOString(),
    })).filter(p => p.name.length > 0)

    const updated = await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: {
        value: JSON.stringify(sanitized),
        label: 'Daftar Produk Pengembangan Demplot',
      },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(sanitized),
        label: 'Daftar Produk Pengembangan Demplot',
      },
    })

    return NextResponse.json({
      success: true,
      products: sanitized,
      updatedAt: updated.updatedAt,
    })
  } catch (err: any) {
    console.error('[API development-products POST] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal menyimpan produk pengembangan.' },
      { status: 500 }
    )
  }
}
