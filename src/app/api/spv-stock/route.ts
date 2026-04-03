import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/spv-stock
 * Mengembalikan daftar produk beserta stok SPV (dari Accurate).
 * Digunakan oleh AFA untuk melihat stok yang tersedia sebelum mengajukan.
 * spvStock selalu dalam satuan kemasan.
 */
export async function GET() {
  try {
    const products = await (prisma.product as any).findMany({
      select: {
        id:             true,
        name:           true,
        unit:           true,
        unitGramasi:    true,
        gramasiPerUnit: true,
        spvStock:       true,
        code:           true,
        accurateId:     true,
      },
      orderBy: { name: 'asc' },
    })

    // Hanya kembalikan produk yang memiliki data unit (sudah dikonfigurasi)
    // dan sertakan semua produk (stok 0 juga ditampilkan supaya AFA tahu apa saja yang ada)
    return NextResponse.json(products)
  } catch (err: any) {
    console.error('[spv-stock] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
