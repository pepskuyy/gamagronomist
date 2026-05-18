import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'

/**
 * Debug login: test each step of login action individually
 * POST /api/debug-login  body: { username, password }
 */
export async function POST(req: Request) {
  const { username, password } = await req.json()
  const steps: Record<string, any> = {}
  const t = () => Date.now()
  let t0 = t()

  // Step 1: DB query
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { area: true }
    })
    steps.db_query = { ok: true, found: !!user, ms: t() - t0 }
    t0 = t()

    if (!user) return NextResponse.json({ steps, error: 'user not found' })

    // Step 2: bcrypt
    try {
      const match = await bcrypt.compare(password, user.password)
      steps.bcrypt = { ok: true, match, ms: t() - t0 }
      t0 = t()
    } catch (e: any) {
      steps.bcrypt = { ok: false, error: e.message, ms: t() - t0 }
    }

    // Step 3: JWT encrypt
    try {
      const token = await encrypt({ userId: user.id, username: user.username, role: user.role })
      steps.encrypt = { ok: true, tokenLen: token.length, ms: t() - t0 }
    } catch (e: any) {
      steps.encrypt = { ok: false, error: e.message }
    }

  } catch (e: any) {
    steps.db_query = { ok: false, error: e.message, ms: t() - t0 }
  }

  return NextResponse.json({ steps })
}
