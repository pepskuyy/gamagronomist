/**
 * Next.js Instrumentation Hook
 * Dijalankan sekali saat server Node.js boot (pada Docker standalone / next start / next dev).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInternalScheduler } = await import('@/lib/scheduler')
    startInternalScheduler()
  }
}
