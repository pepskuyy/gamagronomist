import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ALLOWED_KEYS = [
  { key: 'waha_base_url', label: 'WAHA Base URL' },
  { key: 'waha_api_key', label: 'WAHA API Key' },
  { key: 'waha_session', label: 'WAHA Session Name' },
  { key: 'wa_spv', label: 'No. WA SPV (pisahkan koma jika lebih dari 1)' },
  { key: 'wa_fam', label: 'No. WA FA Manager (pisahkan koma jika lebih dari 1)' },
  { key: 'wa_whm', label: 'No. WA WH Manager (pisahkan koma jika lebih dari 1)' },
]

async function getSession(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ALLOWED_KEYS.map(k => k.key) } }
    })

    // Merge with defaults (ensure all keys appear even if not yet saved)
    const result = ALLOWED_KEYS.map(({ key, label }) => {
      const found = configs.find(c => c.key === key)
      return {
        key,
        label,
        value: found?.value ?? '',
        updatedAt: found?.updatedAt ?? null,
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  try {
    const body = await req.json() as { key: string; value: string }[]

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Body harus berupa array [{ key, value }]' }, { status: 400 })
    }

    const allowedKeySet = new Set(ALLOWED_KEYS.map(k => k.key))
    const results = []

    for (const { key, value } of body) {
      if (!allowedKeySet.has(key)) continue
      const label = ALLOWED_KEYS.find(k => k.key === key)?.label
      const record = await prisma.systemConfig.upsert({
        where: { key },
        update: { value, label },
        create: { key, value, label },
      })
      results.push(record)
    }

    return NextResponse.json({ success: true, updated: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
