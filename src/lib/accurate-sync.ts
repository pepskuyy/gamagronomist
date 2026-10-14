import prisma from '@/lib/prisma'
import { fetchAccurateItems } from '@/lib/accurate'
import { startSyncLog, completeSyncLog, failSyncLog } from '@/lib/sync-logger'


export type SyncResult = {
  inserted: number
  updated: number
  skipped: number
  total: number
  syncedAt: string
}

/**
 * Core sync logic — dapat dipanggil oleh route manual (POST /api/accurate-sync)
 * maupun Vercel Cron (GET /api/accurate-sync-cron).
 * Menyinkronkan nama, SKU, dan stok (spvStock) dari Accurate ke database lokal.
 */
export async function runAccurateSync(
  triggerType: 'MANUAL' | 'OTOMATIS' = 'MANUAL'
): Promise<SyncResult> {
  const startTime = Date.now()
  const logId = await startSyncLog({
    dataType: 'Master Data Barang (Stok & Harga)',
    triggerType,
    message: 'Menarik data master barang dan stok dari Accurate Online...',
  })

  try {
    const accurateItems = await fetchAccurateItems()
    const syncedAt = new Date().toISOString()

    if (accurateItems.length === 0) {
      const duration = Date.now() - startTime
      await completeSyncLog(logId, {
        processedCount: 0,
        message: 'Auto-sync data barang selesai: 0 barang ditemukan',
        durationMs: duration,
      })
      return { inserted: 0, updated: 0, skipped: 0, total: 0, syncedAt }
    }

    // Load semua produk dari DB — hindari N+1 query
    const existingProducts = await (prisma.product as any).findMany({
      select: { id: true, accurateId: true, code: true }
    })

    const byAccurateId = new Map<string, any>()
    const byCode       = new Map<string, any>()
    for (const p of existingProducts) {
      if (p.accurateId) byAccurateId.set(p.accurateId, p)
      if (p.code)       byCode.set(p.code, p)
    }

    let inserted = 0, updated = 0, skipped = 0

    for (const item of accurateItems) {
      const sku      = String(item.no   ?? '').trim()
      const name     = String(item.name ?? '').trim()
      const spvStock = item.availableToSell ?? null

      if (!sku || !name) { skipped++; continue }

      const existing = byAccurateId.get(sku) ?? byCode.get(sku)

      if (existing) {
        await (prisma.product as any).update({
          where: { id: existing.id },
          data: {
            name,
            accurateId: sku,
            code:       sku,
            ...(spvStock !== null ? { spvStock } : {}),
          }
        })
        byAccurateId.set(sku, { ...existing, name, accurateId: sku })
        updated++
      } else {
        const newProduct = await (prisma.product as any).create({
          data: {
            name,
            accurateId: sku,
            code:       sku,
            unit:       'PCS',        // default — harus diisi manual oleh admin
            ...(spvStock !== null ? { spvStock } : {}),
          }
        })
        byAccurateId.set(sku, newProduct)
        byCode.set(sku, newProduct)
        inserted++
      }
    }

    const duration = Date.now() - startTime
    const processedTotal = updated + inserted
    await completeSyncLog(logId, {
      processedCount: processedTotal,
      message: `Auto-sync data barang selesai: ${processedTotal}/${accurateItems.length} barang berhasil diperbarui (error: ${skipped})`,
      durationMs: duration,
    })

    return { inserted, updated, skipped, total: accurateItems.length, syncedAt }
  } catch (err: any) {
    const duration = Date.now() - startTime
    await failSyncLog(logId, {
      error: err,
      message: `Auto-sync data barang gagal: ${err?.message || 'Error'}`,
      durationMs: duration,
    })
    throw err
  }
}
