'use server'

import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

const prisma = new PrismaClient()

export type BulkProductRow = {
  name: string
  unit: string
  description?: string
}

export type BulkImportResult = {
  success?: true
  inserted: number
  skipped: number
  errors: { row: number; name: string; reason: string }[]
}

const VALID_UNITS = ['ml', 'gr', 'kg', 'liter', 'pcs', 'sachet', 'botol']

export async function bulkImportProducts(rows: BulkProductRow[]): Promise<BulkImportResult> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
    return { inserted: 0, skipped: 0, errors: [{ row: 0, name: '-', reason: 'Tidak memiliki akses.' }] }
  }

  let inserted = 0
  let skipped = 0
  const errors: BulkImportResult['errors'] = []

  // Fetch existing product names (lowercase) to detect duplicates
  const existing = await prisma.product.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(p => p.name.toLowerCase().trim()))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row index (1-indexed + header row)

    // Validation
    if (!row.name?.trim()) {
      errors.push({ row: rowNum, name: row.name || '-', reason: 'Nama produk tidak boleh kosong.' })
      skipped++
      continue
    }
    if (!row.unit?.trim() || !VALID_UNITS.includes(row.unit.trim().toLowerCase())) {
      errors.push({ row: rowNum, name: row.name, reason: `Satuan tidak valid: "${row.unit}". Gunakan: ${VALID_UNITS.join(', ')}` })
      skipped++
      continue
    }

    const normalizedName = row.name.trim()
    if (existingNames.has(normalizedName.toLowerCase())) {
      errors.push({ row: rowNum, name: normalizedName, reason: 'Produk dengan nama ini sudah ada (dilewati).' })
      skipped++
      continue
    }

    try {
      await prisma.product.create({
        data: {
          name: normalizedName,
          unit: row.unit.trim().toLowerCase(),
          description: row.description?.trim() || null,
        }
      })
      existingNames.add(normalizedName.toLowerCase())
      inserted++
    } catch (err: any) {
      errors.push({ row: rowNum, name: normalizedName, reason: 'Gagal disimpan: ' + err.message })
      skipped++
    }
  }

  return { success: true, inserted, skipped, errors }
}
