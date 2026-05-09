/**
 * Tujuan     : Utility retry dengan exponential backoff untuk operasi yang bisa gagal sementara (HTTP API, DB timeout)
 * Caller     : lib/accurate.ts (createSalesInvoice), dapat dipakai modul lain
 * Dependensi : Tidak ada dependensi eksternal
 * Main Functions: withRetry(fn, options) — jalankan fn, ulangi jika gagal sesuai config
 * Side Effects  : Delay via setTimeout (non-blocking async), console.warn per retry
 */

export interface RetryOptions {
  /** Jumlah maksimum percobaan total (termasuk percobaan pertama). Default: 3 */
  maxAttempts?: number
  /** Delay awal dalam ms. Akan di-double tiap retry (exponential). Default: 1000 */
  initialDelayMs?: number
  /** Delay maksimum dalam ms. Default: 8000 */
  maxDelayMs?: number
  /** Label untuk logging. Default: 'operation' */
  label?: string
}

/**
 * Jalankan `fn` dan retry otomatis jika melempar error.
 * Delay: initialDelayMs * 2^(attempt-1), capped di maxDelayMs.
 *
 * @throws Error terakhir jika semua attempt habis
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 8000,
    label = 'operation',
  } = options

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt === maxAttempts) break

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      console.warn(
        `[retry] ${label} — attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
