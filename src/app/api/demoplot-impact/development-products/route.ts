import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireApiSession } from '@/lib/session'

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

export interface CandidateProduct {
  id: string
  name: string
  code?: string | null
  unit?: string | null
  source: 'master' | 'sales_invoice'
}

const CONFIG_KEY = 'demoplot_development_products'

export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const [config, masterProducts, recentInvoices] = await Promise.all([
      prisma.systemConfig.findUnique({
        where: { key: CONFIG_KEY },
      }),
      prisma.product.findMany({
        select: { id: true, name: true, code: true, unit: true },
        orderBy: { name: 'asc' },
      }).catch((e) => {
        console.warn('Failed to fetch master products:', e)
        return []
      }),
      prisma.dashboardInvoice.findMany({
        take: 800,
        select: { items: true },
        orderBy: { tanggal: 'desc' },
      }).catch(() => []),
    ])

    let products: DevelopmentProduct[] = []
    if (config?.value) {
      try {
        products = JSON.parse(config.value)
      } catch (e) {
        console.warn('Failed to parse demoplot_development_products json:', e)
        products = []
      }
    }

    // Bangun daftar kandidat produk dari master + invoice
    const candidateMap = new Map<string, CandidateProduct>()

    // 1. Dari master product
    for (const p of masterProducts) {
      if (!p.name) continue
      const key = p.name.trim().toLowerCase()
      candidateMap.set(key, {
        id: p.id,
        name: p.name.trim(),
        code: p.code || null,
        unit: p.unit || null,
        source: 'master',
      })
    }

    // 2. Dari item faktur penjualan (Sales Dashboard)
    for (const inv of recentInvoices) {
      if (Array.isArray(inv.items)) {
        for (const it of inv.items as any[]) {
          if (!it || !it.item_name) continue
          const trimmed = String(it.item_name).trim()
          const key = trimmed.toLowerCase()
          if (!candidateMap.has(key)) {
            candidateMap.set(key, {
              id: it.item_no || `inv_${trimmed.replace(/[^a-zA-Z0-9]/g, '_')}`,
              name: trimmed,
              code: it.item_no || null,
              unit: it.unit || null,
              source: 'sales_invoice',
            })
          }
        }
      }
    }

    const candidateList = Array.from(candidateMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
    )

    return NextResponse.json({
      success: true,
      products,
      candidates: candidateList,
      totalCandidates: candidateList.length,
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
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

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
