/**
 * Tujuan     : Utilitas otentikasi Open API — validasi API key, SHA-256 hashing,
 *              rate limiting in-memory, dan update lastUsedAt.
 * Caller     : Semua route handler di /api/v1/*
 * Dependensi : @prisma/client (model ApiKey), Node.js crypto
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import prisma from '@/lib/prisma'

// ─── Rate Limiter (in-memory sliding window) ─────────────────────────────────
// Map<keyHash, number[]> — timestamps (ms) dari request yang masuk
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 300   // max request
const WINDOW_MS  = 60_000 // per 1 menit

function checkRateLimit(keyHash: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(keyHash) ?? []
  // Buang timestamps di luar window
  const recent = timestamps.filter(t => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    rateLimitMap.set(keyHash, recent)
    return false // terlampaui
  }
  recent.push(now)
  rateLimitMap.set(keyHash, recent)
  return true
}

// ─── Key Generation ───────────────────────────────────────────────────────────

/** Generate raw key: sk_ + 32 hex karakter acak */
export function generateRawKey(): string {
  return 'sk_' + randomBytes(20).toString('hex') // 40 hex = 40 char
}

/** Hash SHA-256 dari raw key */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/** Build masked prefix untuk display di tabel (mis. sk_wD3sgttYj........) */
export function buildKeyPrefix(rawKey: string): string {
  return rawKey.substring(0, 13) + '........'
}

// ─── Request Verification ─────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true;  keyId: string; keyHash: string }
  | { ok: false; response: NextResponse }

/**
 * Verifikasi API key dari header request.
 * - Cek header Authorization: Bearer <key> atau x-api-key: <key>
 * - Cek hash ke database (isActive = true)
 * - Rate limiting 300 req/menit per key
 * - Update lastUsedAt secara async (fire-and-forget)
 */
export async function verifyOpenApiKey(req: NextRequest): Promise<VerifyResult> {
  let rawKey: string | null = null

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim()
  } else {
    rawKey = req.headers.get('x-api-key')
  }

  if (!rawKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'API key tidak ditemukan. Sertakan di header Authorization: Bearer <key> atau x-api-key: <key>.' },
        { status: 401 }
      )
    }
  }

  const keyHash = hashKey(rawKey)

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, isActive: true, keyHash: true }
  })

  if (!apiKey || !apiKey.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'API key tidak valid atau sudah dinonaktifkan.' },
        { status: 401 }
      )
    }
  }

  // Rate limiting
  if (!checkRateLimit(keyHash)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Too Many Requests', message: 'Batas rate limit 300 request/menit terlampaui. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Update lastUsedAt (fire-and-forget, tidak memblokir response)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => { /* ignore errors */ })

  return { ok: true, keyId: apiKey.id, keyHash }
}
