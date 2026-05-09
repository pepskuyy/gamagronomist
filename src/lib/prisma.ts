/**
 * Tujuan     : Singleton PrismaClient untuk seluruh aplikasi (Next.js + serverless-safe)
 * Caller     : Semua actions/*, api/*, lib/* yang butuh akses database
 * Dependensi : @prisma/client, DATABASE_URL env
 * Main Functions: `prisma` — instance tunggal PrismaClient
 * Side Effects  : Membuka koneksi ke PostgreSQL (Neon). Di dev, di-cache di globalThis agar hot-reload tidak buat instance baru.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
