import prisma from '@/lib/prisma'
import { normalizeProductName } from '@/lib/product-name'

/**
 * Daftar Produk Fokus / Pengembangan untuk Opportunity Finder.
 * Disimpan di tabel development_products (global, satu baris per produk).
 */

export interface DevelopmentProductDTO {
  id: string
  name: string
  code: string | null
  targetCrop: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CandidateProduct {
  id: string
  name: string
  code: string | null
  unit: string | null
  source: 'accurate' | 'sales_invoice'
}

export interface UpsertInput {
  name?: string
  code?: string | null
  targetCrop?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface BulkUpsertResult {
  inserted: number
  updated: number
  skipped: number
  errors: { row: number; name: string; reason: string }[]
}

const LEGACY_KEY = 'demoplot_development_products'
const LEGACY_BACKUP_KEY = 'demoplot_development_products__migrated'

const clean = (v: unknown) => {
  const s = v == null ? '' : String(v).trim()
  return s.length > 0 ? s : null
}

function toDTO(p: any): DevelopmentProductDTO {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    targetCrop: p.targetCrop,
    notes: p.notes,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

/**
 * Pindahkan data lama (JSON di SystemConfig) ke tabel, sekali saja.
 * Key lama di-rename sebagai cadangan sehingga tidak dimigrasi ulang.
 */
async function migrateLegacyIfNeeded() {
  const legacy = await prisma.systemConfig.findUnique({ where: { key: LEGACY_KEY } })
  if (!legacy) return

  let parsed: any[] = []
  try {
    const v = JSON.parse(legacy.value)
    if (Array.isArray(v)) parsed = v
  } catch {
    console.warn('[development-products] JSON lama tidak valid, dilewati.')
  }

  const rows = parsed
    .map((p) => ({ name: clean(p?.name), p }))
    .filter((r): r is { name: string; p: any } => !!r.name)
    .map(({ name, p }) => ({
      name,
      nameKey: normalizeProductName(name),
      code: clean(p.code),
      targetCrop: clean(p.targetCrop),
      notes: clean(p.notes),
      isActive: p.isActive !== false,
    }))
    .filter((r) => r.nameKey.length > 0)

  try {
    await prisma.$transaction([
      prisma.developmentProduct.createMany({ data: rows, skipDuplicates: true }),
      prisma.systemConfig.deleteMany({ where: { key: LEGACY_BACKUP_KEY } }),
      prisma.systemConfig.update({ where: { key: LEGACY_KEY }, data: { key: LEGACY_BACKUP_KEY } }),
    ])
    console.log(`[development-products] Migrasi ${rows.length} produk dari SystemConfig selesai.`)
  } catch (err) {
    // Kemungkinan request lain sudah memigrasi lebih dulu — aman diabaikan
    console.warn('[development-products] Migrasi dilewati:', (err as Error).message)
  }
}

export async function listDevelopmentProducts(): Promise<DevelopmentProductDTO[]> {
  await migrateLegacyIfNeeded()
  const rows = await prisma.developmentProduct.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
  return rows.map(toDTO)
}

export async function getActiveDevelopmentProducts(): Promise<DevelopmentProductDTO[]> {
  try {
    await migrateLegacyIfNeeded()
    const rows = await prisma.developmentProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return rows.map(toDTO)
  } catch (err: any) {
    // P2021 = tabel belum dibuat (SQL prisma/sql/development_products.sql belum dijalankan).
    // Pakai data JSON lama agar Opportunity Finder tetap berjalan.
    if (err?.code !== 'P2021') throw err
    console.warn('[development-products] Tabel belum ada, fallback ke SystemConfig JSON.')
    const legacy = await prisma.systemConfig.findUnique({ where: { key: LEGACY_KEY } })
    try {
      const parsed = legacy ? JSON.parse(legacy.value) : []
      const now = new Date().toISOString()
      return (Array.isArray(parsed) ? parsed : [])
        .filter((p: any) => p?.name && p.isActive !== false)
        .map((p: any) => ({
          id: String(p.id || p.name),
          name: String(p.name),
          code: clean(p.code),
          targetCrop: clean(p.targetCrop),
          notes: clean(p.notes),
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
    } catch {
      return []
    }
  }
}

/**
 * Kandidat produk yang bisa dipilih: HANYA SKU Accurate.
 * Invoice Sales Dashboard selalu memakai SKU Accurate, jadi produk gudang sampel
 * (tanpa accurateId) tidak akan pernah cocok dengan invoice.
 */
export async function getCandidateProducts(): Promise<CandidateProduct[]> {
  const [accurateProducts, recentInvoices] = await Promise.all([
    prisma.product.findMany({
      where: { accurateId: { not: null } },
      select: { id: true, name: true, accurateId: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    prisma.dashboardInvoice.findMany({
      take: 800,
      select: { items: true },
      orderBy: { tanggal: 'desc' },
    }).catch(() => []),
  ])

  const map = new Map<string, CandidateProduct>()

  for (const p of accurateProducts) {
    if (!p.name) continue
    const key = normalizeProductName(p.name)
    if (!key || map.has(key)) continue
    map.set(key, { id: p.id, name: p.name.trim(), code: p.accurateId, unit: p.unit || null, source: 'accurate' })
  }

  for (const inv of recentInvoices) {
    if (!Array.isArray(inv.items)) continue
    for (const it of inv.items as any[]) {
      if (!it?.item_name) continue
      const name = String(it.item_name).trim()
      const key = normalizeProductName(name)
      if (!key || map.has(key)) continue
      map.set(key, {
        id: it.item_no || `inv_${key.replace(/\s/g, '_')}`,
        name,
        code: it.item_no || null,
        unit: it.unit || null,
        source: 'sales_invoice',
      })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
  )
}

/**
 * Tambah / perbarui banyak produk sekaligus (dipakai form tambah & import Excel).
 * Produk dicocokkan berdasarkan nama ternormalisasi: jika sudah ada → diperbarui,
 * kolom kosong tidak menimpa nilai lama.
 * `rowOffset` dipakai untuk nomor baris di pesan error (mis. 2 = baris Excel setelah header).
 */
export async function bulkUpsertDevelopmentProducts(
  inputs: UpsertInput[],
  userId: string | null,
  rowOffset = 1
): Promise<BulkUpsertResult> {
  const result: BulkUpsertResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  await migrateLegacyIfNeeded()

  // Lengkapi nama dari SKU Accurate jika hanya kode yang diisi
  const needsLookup = inputs.some((i) => !clean(i.name) && clean(i.code))
  const byCode = new Map<string, string>()
  if (needsLookup) {
    for (const c of await getCandidateProducts()) {
      if (c.code) byCode.set(c.code.toLowerCase(), c.name)
    }
  }

  const seen = new Set<string>()
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const row = i + rowOffset
    const code = clean(input.code)
    const name = clean(input.name) ?? (code ? byCode.get(code.toLowerCase()) ?? null : null)

    if (!name) {
      result.skipped++
      result.errors.push({
        row,
        name: code || '(kosong)',
        reason: code ? 'Kode SKU tidak ditemukan di SKU Accurate.' : 'Nama produk kosong.',
      })
      continue
    }

    const nameKey = normalizeProductName(name)
    if (!nameKey) {
      result.skipped++
      result.errors.push({ row, name, reason: 'Nama produk tidak valid.' })
      continue
    }
    if (seen.has(nameKey)) {
      result.skipped++
      result.errors.push({ row, name, reason: 'Duplikat di dalam file yang sama.' })
      continue
    }
    seen.add(nameKey)

    const targetCrop = clean(input.targetCrop)
    const notes = clean(input.notes)

    try {
      const existing = await prisma.developmentProduct.findUnique({ where: { nameKey } })
      if (existing) {
        await prisma.developmentProduct.update({
          where: { id: existing.id },
          data: {
            ...(code ? { code } : {}),
            ...(targetCrop ? { targetCrop } : {}),
            ...(notes ? { notes } : {}),
            ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
            updatedById: userId,
          },
        })
        result.updated++
      } else {
        await prisma.developmentProduct.create({
          data: {
            name,
            nameKey,
            code,
            targetCrop,
            notes,
            isActive: input.isActive !== false,
            createdById: userId,
            updatedById: userId,
          },
        })
        result.inserted++
      }
    } catch (err: any) {
      result.skipped++
      result.errors.push({
        row,
        name,
        reason: err?.code === 'P2002' ? 'Produk sudah terdaftar.' : 'Gagal menyimpan.',
      })
    }
  }

  return result
}

export async function updateDevelopmentProduct(
  id: string,
  data: { isActive?: boolean; targetCrop?: string | null; notes?: string | null },
  userId: string | null
) {
  const row = await prisma.developmentProduct.update({
    where: { id },
    data: {
      ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
      ...('targetCrop' in data ? { targetCrop: clean(data.targetCrop) } : {}),
      ...('notes' in data ? { notes: clean(data.notes) } : {}),
      updatedById: userId,
    },
  })
  return toDTO(row)
}

export async function deleteDevelopmentProduct(id: string) {
  await prisma.developmentProduct.delete({ where: { id } })
}
