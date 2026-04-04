'use server'

import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export type BulkProductRow = {
  id?: string
  code?: string
  name: string
  unit: string           // kemasan: PCS, Btl, Bks, Box, Sak, gl, Pack, Rol
  unitGramasi?: string   // ml or gr
  gramasiPerUnit?: number
  description?: string
}

export type BulkImportResult = {
  success?: true
  inserted: number
  updated: number
  skipped: number
  errors: { row: number; name: string; reason: string }[]
}

const VALID_UNITS_KEMASAN = ['PCS', 'Btl', 'Bks', 'Box', 'Sak', 'gl', 'Pack', 'Rol']
// Legacy units still accepted for backward compatibility with existing data
const VALID_UNITS_LEGACY = ['ml', 'gr', 'kg', 'liter', 'pcs', 'sachet', 'botol']
const ALL_VALID_UNITS = [...VALID_UNITS_KEMASAN, ...VALID_UNITS_LEGACY]

export async function bulkImportProducts(rows: BulkProductRow[]): Promise<BulkImportResult> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) {
    return { inserted: 0, updated: 0, skipped: 0, errors: [{ row: 0, name: '-', reason: 'Tidak memiliki akses.' }] }
  }

  let inserted = 0
  let updated = 0
  let skipped = 0
  const errors: BulkImportResult['errors'] = []

  // Fetch all existing products: keyed by id and by lowercase name
  const allExisting = await prisma.product.findMany({ select: { id: true, name: true } })
  const existingById = new Map(allExisting.map(p => [p.id, p]))
  const existingByName = new Map(allExisting.map(p => [p.name.toLowerCase().trim(), p]))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row (1-indexed + header = offset 2)

    // Basic validation
    if (!row.name?.trim()) {
      errors.push({ row: rowNum, name: row.name || '-', reason: 'Nama produk tidak boleh kosong.' })
      skipped++
      continue
    }
    if (!row.unit?.trim() || !ALL_VALID_UNITS.includes(row.unit.trim())) {
      errors.push({ row: rowNum, name: row.name, reason: `Satuan tidak valid: "${row.unit}". Kemasan: ${VALID_UNITS_KEMASAN.join(', ')}` })
      skipped++
      continue
    }

    const normalizedGramasi = row.unitGramasi?.trim().toLowerCase() || null
    const gramasiPerUnit = row.gramasiPerUnit && row.gramasiPerUnit > 0 ? row.gramasiPerUnit : null

    // Validation: if they provide gramasi amount, they MUST provide the unit (and vice versa)
    if ((normalizedGramasi && !gramasiPerUnit) || (!normalizedGramasi && gramasiPerUnit)) {
      errors.push({ row: rowNum, name: row.name, reason: `Satuan gramasi dan isinya harus diisi bersaman (tidak boleh salah satu kosong).` })
      skipped++
      continue
    }

    const normalizedName = row.name.trim()
    // Keep original case for kemasan (Btl, PCS, etc.), only lowercase legacy units
    const normalizedUnit = row.unit.trim()
    const productId = row.id?.trim()

    // ── CASE 1: id provided and matches existing product → UPDATE ──
    if (productId && existingById.has(productId)) {
      try {
        await prisma.product.update({
          where: { id: productId },
          data: {
            code: row.code?.trim() || null,
            name: normalizedName,
            unit: normalizedUnit,
            description: row.description?.trim() || null,
            unitGramasi: normalizedGramasi,
            gramasiPerUnit: gramasiPerUnit,
          } as any
        })
        existingById.set(productId, { id: productId, name: normalizedName })
        existingByName.set(normalizedName.toLowerCase(), { id: productId, name: normalizedName })
        updated++
      } catch (err: any) {
        errors.push({ row: rowNum, name: normalizedName, reason: 'Gagal diperbarui: ' + err.message })
        skipped++
      }
      continue
    }

    // ── CASE 2: id provided but NOT found → create with provided id ──
    if (productId && !existingById.has(productId)) {
      if (existingByName.has(normalizedName.toLowerCase())) {
        errors.push({ row: rowNum, name: normalizedName, reason: 'Nama produk sudah ada dan ID tidak cocok dengan produk mana pun (dilewati).' })
        skipped++
        continue
      }
      try {
        await prisma.product.create({
          data: {
            id: productId,
            code: row.code?.trim() || null,
            name: normalizedName,
            unit: normalizedUnit,
            description: row.description?.trim() || null,
            unitGramasi: normalizedGramasi,
            gramasiPerUnit: gramasiPerUnit,
          } as any
        })
        existingById.set(productId, { id: productId, name: normalizedName })
        existingByName.set(normalizedName.toLowerCase(), { id: productId, name: normalizedName })
        inserted++
      } catch (err: any) {
        errors.push({ row: rowNum, name: normalizedName, reason: 'Gagal disimpan: ' + err.message })
        skipped++
      }
      continue
    }

    // ── CASE 3: No id provided → create new, skip if name duplicate ──
    if (existingByName.has(normalizedName.toLowerCase())) {
      errors.push({ row: rowNum, name: normalizedName, reason: 'Produk dengan nama ini sudah ada (dilewati). Sertakan id_db untuk memperbarui.' })
      skipped++
      continue
    }

    try {
      const created = await prisma.product.create({
        data: {
          code: row.code?.trim() || null,
          name: normalizedName,
          unit: normalizedUnit,
          description: row.description?.trim() || null,
          unitGramasi: normalizedGramasi,
          gramasiPerUnit: gramasiPerUnit,
        } as any
      })
      existingById.set(created.id, { id: created.id, name: normalizedName })
      existingByName.set(normalizedName.toLowerCase(), { id: created.id, name: normalizedName })
      inserted++
    } catch (err: any) {
      errors.push({ row: rowNum, name: normalizedName, reason: 'Gagal disimpan: ' + err.message })
      skipped++
    }
  }

  revalidatePath('/dashboard/master/products')
  return { success: true, inserted, updated, skipped, errors }
}
