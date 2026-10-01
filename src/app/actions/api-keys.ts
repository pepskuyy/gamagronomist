'use server'

/**
 * Tujuan     : Server Actions untuk manajemen API Key Open API (Admin only)
 * Caller     : OpenApiClient.tsx (UI Admin)
 * Dependensi : prisma, open-api-auth (hashing+generate), auth (session check)
 */

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateRawKey, hashKey, buildKeyPrefix } from '@/lib/open-api-auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!session?.userId || session.role !== 'ADMIN') {
    throw new Error('Unauthorized: hanya ADMIN yang dapat mengelola API key.')
  }
  return session
}

// ─── Generate API Key baru ────────────────────────────────────────────────────
export async function generateApiKeyAction(appName: string) {
  const session = await requireAdmin()

  const trimmed = appName.trim()
  if (!trimmed) return { success: false, error: 'Nama aplikasi konsumen wajib diisi.' }

  const rawKey   = generateRawKey()
  const keyHash  = hashKey(rawKey)
  const keyPrefix = buildKeyPrefix(rawKey)

  const apiKey = await prisma.apiKey.create({
    data: {
      name:        trimmed,
      keyHash,
      keyPrefix,
      isActive:    true,
      createdById: session.userId,
    }
  })

  revalidatePath('/dashboard/open-api')

  return {
    success: true,
    rawKey,              // ← ditampilkan SATU KALI ke admin, setelah itu tidak bisa didapat lagi
    item: {
      id:          apiKey.id,
      name:        apiKey.name,
      keyPrefix:   apiKey.keyPrefix,
      isActive:    apiKey.isActive,
      lastUsedAt:  apiKey.lastUsedAt,
      createdAt:   apiKey.createdAt,
    }
  }
}

// ─── Toggle aktif / nonaktif ──────────────────────────────────────────────────
export async function toggleApiKeyAction(keyId: string, isActive: boolean) {
  await requireAdmin()

  await prisma.apiKey.update({
    where: { id: keyId },
    data:  { isActive }
  })

  revalidatePath('/dashboard/open-api')
  return { success: true }
}

// ─── Hapus API Key ────────────────────────────────────────────────────────────
export async function deleteApiKeyAction(keyId: string) {
  await requireAdmin()

  await prisma.apiKey.delete({ where: { id: keyId } })

  revalidatePath('/dashboard/open-api')
  return { success: true }
}
