import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Debug endpoint: test apakah Prisma model query bisa jalan di Vercel
 * GET /api/debug-db
 */
export async function GET() {
  const results: Record<string, any> = {}

  // Test 1: Raw query
  try {
    const raw = await prisma.$queryRaw`SELECT 1 as val`
    results.raw_query = { ok: true, data: raw }
  } catch (e: any) {
    results.raw_query = { ok: false, error: e.message }
  }

  // Test 2: Model query sederhana (tanpa include)
  try {
    const count = await prisma.user.count()
    results.user_count = { ok: true, count }
  } catch (e: any) {
    results.user_count = { ok: false, error: e.message }
  }

  // Test 3: findUnique (seperti login)
  try {
    const user = await prisma.user.findFirst({
      select: { id: true, username: true, role: true }
    })
    results.find_first = { ok: true, user: user?.username }
  } catch (e: any) {
    results.find_first = { ok: false, error: e.message }
  }

  // Test 4: findFirst dengan include (persis seperti login action)
  try {
    const user = await prisma.user.findFirst({
      include: { area: true }
    })
    results.find_with_include = { ok: true, username: user?.username }
  } catch (e: any) {
    results.find_with_include = { ok: false, error: e.message }
  }

  return NextResponse.json(results)
}
