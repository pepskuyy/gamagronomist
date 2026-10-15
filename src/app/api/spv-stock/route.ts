import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireApiSession } from '@/lib/session'

/**
 * GET /api/spv-stock
 * Mengembalikan daftar produk beserta stok SPV (dari Accurate).
 * Digunakan oleh AFA untuk melihat stok yang tersedia sebelum mengajukan.
 * spvStock selalu dalam satuan kemasan.
 */
export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

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
        updatedAt:      true,
      },
      where: { accurateId: { not: null } },
      orderBy: { name: 'asc' },
    })

    // Ambil waktu sync terakhir dari produk yang punya spvStock (diupdate saat sync)
    const synced = products.filter((p: any) => p.spvStock !== null)
    const lastSyncedAt = synced.length > 0
      ? new Date(Math.max(...synced.map((p: any) => new Date(p.updatedAt).getTime()))).toISOString()
      : null

    return NextResponse.json({ products, lastSyncedAt })
  } catch (err: any) {
    console.error('[spv-stock] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
