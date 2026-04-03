import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { runAccurateSync } from '@/lib/accurate-sync'

/**
 * POST /api/accurate-sync
 * Trigger manual sync dari UI (tombol "Sync Accurate").
 * Hanya ADMIN/SPV yang boleh memicu sync ini.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)
    if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya ADMIN/SPV.' }, { status: 403 })
    }

    const result = await runAccurateSync()

    const isEmpty = result.total === 0
    return NextResponse.json({
      success: true,
      message: isEmpty
        ? 'Tidak ada produk ditemukan di Accurate Online.'
        : `Sinkronisasi selesai: ${result.inserted} produk baru, ${result.updated} diperbarui, ${result.skipped} dilewati.`,
      ...result,
    })
  } catch (err: any) {
    console.error('[accurate-sync] error:', err)
    return NextResponse.json({
      error: 'Gagal sinkronisasi dari Accurate: ' + (err.message ?? 'Unknown error')
    }, { status: 500 })
  }
}
