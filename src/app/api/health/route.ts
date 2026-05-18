import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Health check endpoint — dipanggil oleh UptimeRobot setiap 5 menit
 * agar database Neon tidak suspend karena idle.
 */
export async function GET() {
  try {
    // Query ringan untuk menjaga koneksi DB tetap aktif
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
