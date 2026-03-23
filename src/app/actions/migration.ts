'use server'

import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await decrypt(cookieStore.get('session')?.value as string)
  if (!['ADMIN', 'SPV'].includes(session?.role ?? '')) throw new Error('Akses ditolak.')
  return session
}

// ─── AREA ──────────────────────────────────────
export type AreaRow = { name: string }

export async function bulkImportAreas(rows: AreaRow[]) {
  await requireAdmin()
  let inserted = 0, skipped = 0
  const errors: { row: number; name: string; reason: string }[] = []
  const existing = await prisma.area.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(a => a.name.toLowerCase().trim()))

  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].name?.trim()
    if (!name) { errors.push({ row: i + 2, name: '-', reason: 'Nama area kosong.' }); skipped++; continue }
    if (existingNames.has(name.toLowerCase())) { errors.push({ row: i + 2, name, reason: 'Sudah ada.' }); skipped++; continue }
    try {
      await prisma.area.create({ data: { name } })
      existingNames.add(name.toLowerCase())
      inserted++
    } catch { errors.push({ row: i + 2, name, reason: 'Gagal disimpan.' }); skipped++ }
  }
  return { success: true, inserted, skipped, errors }
}

// ─── USER ──────────────────────────────────────
export type UserRow = { username: string; password: string; name: string; role: string; areaName?: string; afaName?: string; status?: string }

export async function bulkImportUsers(rows: UserRow[]) {
  await requireAdmin()
  let inserted = 0, skipped = 0
  const errors: { row: number; name: string; reason: string }[] = []

  const areas = await prisma.area.findMany({ select: { id: true, name: true } })
  const areaMap = new Map(areas.map(a => [a.name.toLowerCase().trim(), a.id]))

  const afas = await prisma.user.findMany({ where: { role: 'AFA' }, select: { id: true, name: true } })
  const afaMap = new Map(afas.map(a => [a.name.toLowerCase().trim(), a.id]))

  const existingUsernames = new Set((await prisma.user.findMany({ select: { username: true } })).map(u => u.username.toLowerCase()))
  const VALID_ROLES = ['ADMIN', 'SPV', 'AFA', 'FO', 'INTERN']

  // Phase 1: Validate all rows and pre-hash passwords in parallel
  type ValidatedRow = { rowNum: number; username: string; password: string; name: string; role: string; areaId: string | null; afaId: string | null; isActive: boolean }
  const validRows: ValidatedRow[] = []
  const hashPromises: Promise<string>[] = []
  const hashIndices: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    if (!r.username?.trim() || !r.name?.trim() || !r.password?.trim() || !r.role?.trim()) {
      errors.push({ row: rowNum, name: r.name || '-', reason: 'username, password, nama, dan role wajib diisi.' }); skipped++; continue
    }
    const role = r.role.trim().toUpperCase()
    if (!VALID_ROLES.includes(role)) {
      errors.push({ row: rowNum, name: r.name, reason: `Role "${r.role}" tidak valid. Gunakan: ${VALID_ROLES.join(', ')}` }); skipped++; continue
    }
    if (existingUsernames.has(r.username.trim().toLowerCase())) {
      errors.push({ row: rowNum, name: r.name, reason: 'Username sudah terdaftar.' }); skipped++; continue
    }

    const areaId = r.areaName ? areaMap.get(r.areaName.trim().toLowerCase()) || null : null
    const afaId = r.afaName && (role === 'FO' || role === 'INTERN') ? afaMap.get(r.afaName.trim().toLowerCase()) || null : null
    const isActive = r.status ? !['nonaktif', 'inactive', 'false', '0', 'tidak'].includes(r.status.trim().toLowerCase()) : true

    // Queue the hash and mark this row's index
    hashIndices.push(validRows.length)
    hashPromises.push(bcrypt.hash(r.password.trim(), 6))
    validRows.push({ rowNum, username: r.username.trim(), password: '', name: r.name.trim(), role, areaId, afaId, isActive })
    existingUsernames.add(r.username.trim().toLowerCase())
  }

  // Phase 2: Await all hashes in parallel (much faster than sequential)
  const hashes = await Promise.all(hashPromises)
  for (let i = 0; i < hashes.length; i++) {
    validRows[hashIndices[i]].password = hashes[i]
  }

  // Phase 3: Insert all validated rows
  for (const vr of validRows) {
    try {
      const user = await prisma.user.create({
        data: { username: vr.username, password: vr.password, name: vr.name, role: vr.role, areaId: vr.areaId, afaId: vr.afaId, isActive: vr.isActive }
      })
      if (vr.role === 'AFA') afaMap.set(vr.name.toLowerCase(), user.id)
      inserted++
    } catch (e: any) {
      errors.push({ row: vr.rowNum, name: vr.name, reason: e?.code === 'P2002' ? 'Username duplikat.' : 'Gagal disimpan.' }); skipped++
    }
  }
  return { success: true, inserted, skipped, errors }
}

// ─── FARMER ────────────────────────────────────
export type FarmerRow = { name: string; phone?: string; address?: string; area?: string }

export async function bulkImportFarmers(rows: FarmerRow[]) {
  await requireAdmin()
  let inserted = 0, skipped = 0
  const errors: { row: number; name: string; reason: string }[] = []
  const existing = await prisma.farmer.findMany({ select: { name: true, phone: true } })
  const existingKeys = new Set(existing.map(f => `${f.name.toLowerCase().trim()}|${(f.phone || '').trim()}`))

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    const name = r.name?.trim()
    if (!name) { errors.push({ row: rowNum, name: '-', reason: 'Nama petani kosong.' }); skipped++; continue }
    const key = `${name.toLowerCase()}|${(r.phone || '').trim()}`
    if (existingKeys.has(key)) { errors.push({ row: rowNum, name, reason: 'Sudah ada (nama+telepon sama).' }); skipped++; continue }
    try {
      await prisma.farmer.create({ data: { name, phone: r.phone?.trim() || null, address: r.address?.trim() || null, area: r.area?.trim() || null } })
      existingKeys.add(key)
      inserted++
    } catch { errors.push({ row: rowNum, name, reason: 'Gagal disimpan.' }); skipped++ }
  }
  return { success: true, inserted, skipped, errors }
}

// ─── CUSTOMER BEHAVIOR ─────────────────────────
export type CBRow = {
  username: string; farmerName: string; age?: string; phone?: string;
  kabupaten?: string; kecamatan?: string; desa?: string;
  commodity?: string; reasonChoice?: string; constraints?: string;
  optTypes?: string; optDetails?: string; usedProducts?: string; buyLocation?: string;
  buyReason?: string; references?: string; notes?: string
}

export async function bulkImportCustomerBehaviors(rows: CBRow[]) {
  await requireAdmin()
  let inserted = 0, skipped = 0
  let farmersCreated = 0
  const errors: { row: number; name: string; reason: string }[] = []

  const users = await prisma.user.findMany({ select: { id: true, username: true } })
  const userMap = new Map(users.map(u => [u.username.toLowerCase().trim(), u.id]))

  // Load existing farmers to avoid duplicates
  const existingFarmers = await prisma.farmer.findMany({ select: { name: true, phone: true } })
  const farmerKeys = new Set(existingFarmers.map(f => f.name.toLowerCase().trim()))

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    if (!r.username?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'username_pelapor kosong.' }); skipped++; continue }
    if (!r.farmerName?.trim()) { errors.push({ row: rowNum, name: '-', reason: 'nama_petani kosong.' }); skipped++; continue }
    const userId = userMap.get(r.username.trim().toLowerCase())
    if (!userId) { errors.push({ row: rowNum, name: r.farmerName, reason: `User "${r.username}" tidak ditemukan.` }); skipped++; continue }

    // Build address from kabupaten/kecamatan/desa
    const parts = [r.desa, r.kecamatan, r.kabupaten].filter(p => p?.trim()).map(p => p!.trim())
    const address = parts.length > 0 ? parts.join(', ') : null

    try {
      // Auto-create Farmer if not exists
      const farmerName = r.farmerName.trim()
      if (!farmerKeys.has(farmerName.toLowerCase())) {
        await prisma.farmer.create({
          data: {
            name: farmerName,
            phone: r.phone?.trim() || null,
            address,
            area: r.kabupaten?.trim() || null,
          }
        })
        farmerKeys.add(farmerName.toLowerCase())
        farmersCreated++
      }

      await prisma.customerBehavior.create({
        data: {
          userId,
          farmerName,
          age: r.age?.trim() || null,
          phone: r.phone?.trim() || null,
          address,
          district: r.kecamatan?.trim() || null,
          commodity: r.commodity?.trim() || null,
          reasonChoice: r.reasonChoice?.trim() || null,
          constraints: r.constraints?.trim() || null,
          optTypes: r.optTypes?.trim() || null,
          optDetails: r.optDetails?.trim() || null,
          usedProducts: r.usedProducts?.trim() || null,
          buyLocation: r.buyLocation?.trim() || null,
          buyReason: r.buyReason?.trim() || null,
          references: r.references?.trim() || null,
          notes: r.notes?.trim() || null,
        }
      })
      inserted++
    } catch (e: any) {
      errors.push({ row: rowNum, name: r.farmerName, reason: 'Gagal disimpan: ' + e.message }); skipped++
    }
  }
  return { success: true, inserted, skipped, errors, farmersCreated }
}

// ─── DEMO PLOT ─────────────────────────────────
export type DemoPlotRow = {
  date: string; area?: string; commodity?: string; landSize?: string;
  resultNotes?: string; farmerName?: string; isFinalSession?: string;
  latitude?: string; longitude?: string
}

export async function bulkImportDemoPlots(rows: DemoPlotRow[]) {
  await requireAdmin()
  let inserted = 0, skipped = 0
  const errors: { row: number; name: string; reason: string }[] = []

  const farmers = await prisma.farmer.findMany({ select: { id: true, name: true } })
  const farmerMap = new Map(farmers.map(f => [f.name.toLowerCase().trim(), f.id]))

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    if (!r.date?.trim()) { errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'Tanggal kosong.' }); skipped++; continue }

    let parsedDate: Date
    try {
      // Support DD/MM/YYYY or YYYY-MM-DD
      const d = r.date.trim()
      if (d.includes('/')) {
        const [day, month, year] = d.split('/')
        parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
      } else {
        parsedDate = new Date(d)
      }
      if (isNaN(parsedDate.getTime())) throw new Error('Invalid')
    } catch {
      errors.push({ row: rowNum, name: r.farmerName || '-', reason: `Format tanggal "${r.date}" tidak valid. Gunakan DD/MM/YYYY atau YYYY-MM-DD.` }); skipped++; continue
    }

    const farmerId = r.farmerName ? farmerMap.get(r.farmerName.trim().toLowerCase()) || null : null
    const lat = r.latitude ? parseFloat(r.latitude) : null
    const lng = r.longitude ? parseFloat(r.longitude) : null
    const isFinal = r.isFinalSession?.trim().toLowerCase()

    try {
      await prisma.demoPlot.create({
        data: {
          date: parsedDate,
          area: r.area?.trim() || null,
          commodity: r.commodity?.trim() || null,
          landSize: r.landSize ? parseFloat(r.landSize) || null : null,
          resultNotes: r.resultNotes?.trim() || null,
          farmerId,
          isFinalSession: isFinal === 'ya' || isFinal === 'true' || isFinal === '1' || isFinal === 'yes',
          latitude: isNaN(lat as number) ? null : lat,
          longitude: isNaN(lng as number) ? null : lng,
        }
      })
      inserted++
    } catch (e: any) {
      errors.push({ row: rowNum, name: r.farmerName || '-', reason: 'Gagal disimpan: ' + e.message }); skipped++
    }
  }
  return { success: true, inserted, skipped, errors }
}
