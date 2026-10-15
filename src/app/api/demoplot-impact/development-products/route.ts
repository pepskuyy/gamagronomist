import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'
import {
  listDevelopmentProducts,
  getCandidateProducts,
  bulkUpsertDevelopmentProducts,
  updateDevelopmentProduct,
  deleteDevelopmentProduct,
  type UpsertInput,
} from '@/lib/development-products'

export const dynamic = 'force-dynamic'

const MAX_IMPORT_ROWS = 1000

/** GET — daftar produk fokus + kandidat SKU Accurate untuk dipilih */
export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const [products, candidates] = await Promise.all([
      listDevelopmentProducts(),
      getCandidateProducts(),
    ])
    return NextResponse.json({
      success: true,
      products,
      candidates,
      totalCandidates: candidates.length,
    })
  } catch (err: any) {
    console.error('[API development-products GET] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal memuat produk pengembangan.' },
      { status: 500 }
    )
  }
}

/**
 * POST — tambah / perbarui produk.
 * Body: { products: UpsertInput[], rowOffset?: number }
 * Dipakai untuk tambah satu produk (array 1 item) maupun import Excel.
 */
export async function POST(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const products: UpsertInput[] = body?.products

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Format data tidak valid. Wajib berupa array produk.' },
        { status: 400 }
      )
    }
    if (products.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_IMPORT_ROWS} baris per import.` },
        { status: 400 }
      )
    }

    const rowOffset = Number.isInteger(body?.rowOffset) ? body.rowOffset : 1
    const result = await bulkUpsertDevelopmentProducts(products, auth.userId, rowOffset)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('[API development-products POST] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Gagal menyimpan produk pengembangan.' },
      { status: 500 }
    )
  }
}

/** PATCH — ubah status aktif / komoditas / catatan satu produk. Body: { id, isActive?, targetCrop?, notes? } */
export async function PATCH(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID produk wajib diisi.' }, { status: 400 })

    const product = await updateDevelopmentProduct(String(id), data, auth.userId)
    return NextResponse.json({ success: true, product })
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Produk tidak ditemukan (mungkin sudah dihapus).' }, { status: 404 })
    }
    console.error('[API development-products PATCH] Error:', err)
    return NextResponse.json({ error: 'Gagal memperbarui produk.' }, { status: 500 })
  }
}

/** DELETE — hapus satu produk. Query: ?id=xxx */
export async function DELETE(req: Request) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID produk wajib diisi.' }, { status: 400 })

    await deleteDevelopmentProduct(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ success: true }) // sudah terhapus oleh user lain
    }
    console.error('[API development-products DELETE] Error:', err)
    return NextResponse.json({ error: 'Gagal menghapus produk.' }, { status: 500 })
  }
}
