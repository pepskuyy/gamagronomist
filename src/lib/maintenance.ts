import prisma from '@/lib/prisma'
import { withRetry } from '@/lib/retry'

/**
 * Status maintenance mode dengan memo in-process (TTL pendek).
 *
 * Sebelumnya layout dashboard melakukan 1 query SystemConfig di SETIAP
 * navigasi/render RSC. Memo 15 detik menghilangkan round-trip tersebut;
 * toggleMaintenanceMode() memanggil invalidateMaintenanceCache() sehingga
 * perubahan di instance yang sama langsung berlaku. Pada deployment
 * multi-instance, perubahan berlaku paling lambat ~15 detik.
 *
 * FAIL-OPEN: gangguan DB sesaat tidak mengunci user (perilaku sama seperti
 * sebelumnya). Kegagalan tidak di-cache agar percobaan berikutnya tetap
 * mencoba DB.
 */

const TTL_MS = 15 * 1000

let cached: { value: boolean; at: number } | null = null
let inflight: Promise<boolean> | null = null

export async function isMaintenanceMode(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const config = await withRetry(
        () => prisma.systemConfig.findUnique({ where: { key: 'maintenance_mode' } }),
        { maxAttempts: 2, initialDelayMs: 200, maxDelayMs: 400, label: 'maintenance_mode check' }
      )
      const value = config?.value === 'true'
      cached = { value, at: Date.now() }
      return value
    } catch (error) {
      console.error('[maintenance-check] DB unreachable, fail-open:', error)
      return false
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Dipanggil setelah status maintenance diubah. */
export function invalidateMaintenanceCache() {
  cached = null
}
