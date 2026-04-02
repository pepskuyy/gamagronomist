import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { fetchAccurateItems } from '@/lib/accurate'

const prisma = new PrismaClient()

/**
 * POST /api/accurate-sync
 * Sinkronisasi master produk dari Accurate Online.
 * Hanya ADMIN/SPV yang boleh memicu sync ini.
 *
 * Logika:
 * - Produk dengan accurateId (no_barang) sudah ada → UPDATE nama saja
 * - Produk dengan code = no_barang (data lama) → link + update
 * - Belum ada sama sekali → INSERT baru (unit='PCS', perlu diisi manual)
 */
export async function POST() {
  try {
    // Auth check
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya ADMIN/SPV.' }, { status: 403 })
    }

    // Fetch semua produk dari Accurate
    const accurateItems = await fetchAccurateItems()

    if (accurateItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada produk ditemukan di Accurate Online.',
        inserted: 0, updated: 0, skipped: 0, total: 0,
      })
    }

    // Load semua produk yang sudah ada di DB (untuk efisiensi — hindari N+1 query)
    const existingProducts = await (prisma.product as any).findMany({
      select: { id: true, accurateId: true, code: true, name: true }
    })

    // Build lookup maps
    const byAccurateId = new Map<string, any>()
    const byCode       = new Map<string, any>()
    for (const p of existingProducts) {
      if (p.accurateId) byAccurateId.set(p.accurateId, p)
      if (p.code)       byCode.set(p.code, p)
    }

    let inserted = 0
    let updated  = 0
    let skipped  = 0

    for (const item of accurateItems) {
      const sku  = String(item.no ?? '').trim()
      const name = String(item.name ?? '').trim()

      if (!sku || !name) { skipped++; continue }

      // Prioritas lookup: 1) accurateId, 2) code (backward compat)
      const existing = byAccurateId.get(sku) ?? byCode.get(sku)

      if (existing) {
        // Update: hanya nama dan linkkan accurateId (jangan sentuh unit/gramasi)
        await (prisma.product as any).update({
          where: { id: existing.id },
          data: {
            name,
            accurateId: sku,
            code: sku,        // jadikan code konsisten dengan SKU
          }
        })
        // Perbarui map untuk hindari konflik di iterasi selanjutnya
        byAccurateId.set(sku, { ...existing, name, accurateId: sku })
        updated++
      } else {
        // Insert produk baru — unit default PCS, admin harus set satuan manual setelahnya
        const newProduct = await (prisma.product as any).create({
          data: {
            name,
            accurateId: sku,
            code: sku,
            unit: 'PCS',  // default, harus diisi manual oleh admin
          }
        })
        byAccurateId.set(sku, newProduct)
        byCode.set(sku, newProduct)
        inserted++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi selesai: ${inserted} produk baru ditambahkan, ${updated} diperbarui, ${skipped} dilewati.`,
      inserted,
      updated,
      skipped,
      total: accurateItems.length,
    })
  } catch (err: any) {
    console.error('[accurate-sync] error:', err)
    return NextResponse.json({
      error: 'Gagal sinkronisasi dari Accurate: ' + (err.message ?? 'Unknown error')
    }, { status: 500 })
  }
}
