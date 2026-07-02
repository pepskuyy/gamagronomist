/**
 * Tujuan     : Singleton PrismaClient untuk seluruh aplikasi (Next.js + serverless-safe)
 * Caller     : Semua actions/*, api/*, lib/* yang butuh akses database
 * Dependensi : @prisma/client, DATABASE_URL env
 * Main Functions: `prisma` — instance tunggal PrismaClient
 * Side Effects  : Membuka koneksi ke PostgreSQL (Neon). Di dev, di-cache di globalThis agar hot-reload tidak buat instance baru.
 */

import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Buat pool koneksi pg dengan konfigurasi yang optimal untuk serverless (Neon)
const connectionString = process.env.DATABASE_URL
const pool = new Pool({
  connectionString,
  max: 5,                      // batasi koneksi max agar tidak overwhelm Neon serverless
  idleTimeoutMillis: 30000,    // lepas koneksi idle setelah 30 detik
  connectionTimeoutMillis: 5000, // timeout tunggu koneksi baru
})
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter, // Gunakan pg adapter
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
