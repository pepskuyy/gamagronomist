import { NextResponse } from 'next/server'
import { getStore12MonthInvoices } from '@/lib/demoplot-impact'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId') || undefined
    const storeName = searchParams.get('storeName') || undefined

    if (!customerId && !storeName) {
      return NextResponse.json({ error: 'Parameter customerId atau storeName wajib disertakan.' }, { status: 400 })
    }

    const invoices = await getStore12MonthInvoices(customerId, storeName)
    return NextResponse.json({ invoices })
  } catch (err: any) {
    console.error('[API demoplot-impact/store-history] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal memuat riwayat transaksi toko.' },
      { status: 500 }
    )
  }
}
