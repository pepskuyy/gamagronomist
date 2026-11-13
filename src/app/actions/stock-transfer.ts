'use server'

/**
 * Transfer stok antar AFA:
 *   SUBMITTED (pengirim mengajukan) → APPROVED (SPV/ADMIN, jumlah bisa dikurangi)
 *   → RECEIVED (penerima konfirmasi; baru di sini stok berpindah)
 *   REJECTED: SPV/ADMIN dari SUBMITTED/APPROVED · CANCELLED: pengirim dari SUBMITTED.
 * Koreksi langsung tanpa approval tetap lewat transferStockBetweenUsers (stock-admin.ts).
 */
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  assertStockAvailable,
  findStockShortages,
  findUndecidedUnitProducts,
  stockShortageMessage,
  unitHoldMessage,
  StockShortageError,
} from '@/lib/ledger/stock'

const SENDER_ROLES = ['AFA', 'PLANTATION']
const SHORTAGE_HINT = 'Saldo pengirim tidak cukup. Minta pengirim menambah stok, atau SPV menolak transfer ini.'

async function getSession() {
  const cookieStore = await cookies()
  return decrypt(cookieStore.get('session')?.value as string)
}

class TransferStateError extends Error {}

/** Ubah status hanya bila masih di status yang diharapkan (mencegah proses ganda). */
async function transition(db: any, id: string, from: string | string[], data: Record<string, unknown>) {
  const res = await db.stockTransfer.updateMany({
    where: { id, status: Array.isArray(from) ? { in: from } : from },
    data,
  })
  if (res.count !== 1) throw new TransferStateError('Transfer sudah diproses oleh orang lain. Muat ulang halaman.')
}

async function notify(userIds: (string | null | undefined)[], title: string, message: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[]
  if (ids.length === 0) return
  try {
    await prisma.notification.createMany({ data: ids.map(userId => ({ userId, title, message, link: '/dashboard/stock' })) })
  } catch (e) {
    console.error('[stock-transfer] notifikasi gagal:', e)
  }
}

/** SPV di area pengirim + SPV global (areaId kosong), sama seperti alur restock AFA */
async function spvIdsFor(areaId: string | null) {
  const spvs = await prisma.user.findMany({
    where: { role: 'SPV', isActive: true, ...(areaId ? { OR: [{ areaId }, { areaId: null }] } : {}) },
    select: { id: true },
  })
  return spvs.map(s => s.id)
}

/** SPV hanya memproses transfer dari pengirim di areanya; SPV tanpa area & ADMIN boleh semua. */
async function canApprove(session: any, fromAreaId: string | null) {
  if (session?.role === 'ADMIN') return true
  if (session?.role !== 'SPV') return false
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { areaId: true } })
  return !me?.areaId || me.areaId === fromAreaId
}

function fail(err: any, fallback: string) {
  if (err instanceof TransferStateError || err instanceof StockShortageError) return { error: err.message }
  console.error('[stock-transfer]', err)
  return { error: fallback }
}

export async function submitStockTransfer(data: {
  toUserId: string
  items: { productId: string; quantity: number }[]
  notes?: string
}) {
  const session = await getSession()
  if (!session?.userId || !SENDER_ROLES.includes(session.role)) return { error: 'Hanya AFA yang dapat mengajukan transfer stok.' }

  const items = (data.items ?? []).filter(i => i.productId)
  if (items.length === 0 || items.some(i => !(Number(i.quantity) > 0))) return { error: 'Isi minimal 1 produk dengan jumlah > 0.' }
  if (new Set(items.map(i => i.productId)).size !== items.length) return { error: 'Tidak boleh ada produk yang sama dalam satu transfer.' }
  if (!data.toUserId || data.toUserId === session.userId) return { error: 'Pilih AFA penerima yang lain.' }

  try {
    const [to, from] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.toUserId }, select: { name: true, role: true, isActive: true } }),
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, areaId: true } }),
    ])
    if (!to || !to.isActive || !SENDER_ROLES.includes(to.role)) return { error: 'Penerima harus AFA yang aktif.' }

    const held = await findUndecidedUnitProducts(prisma, items.map(i => i.productId))
    if (held.length > 0) return { error: unitHoldMessage(held) }
    const shortages = await findStockShortages(session.userId, items.map(i => ({ productId: i.productId, qty: Number(i.quantity) })))
    if (shortages.length > 0) return { error: stockShortageMessage(shortages, 'Jumlah transfer tidak boleh melebihi saldo Anda.') }

    const transfer = await prisma.stockTransfer.create({
      data: {
        fromUserId: session.userId,
        toUserId: data.toUserId,
        notes: data.notes?.trim() || null,
        items: { create: items.map(i => ({ productId: i.productId, qtyRequested: Number(i.quantity) })) },
      },
    })

    await notify(await spvIdsFor(from?.areaId ?? null), 'Pengajuan Transfer Stok',
      `${from?.name ?? 'AFA'} mengajukan transfer ${items.length} produk ke ${to.name}. Menunggu persetujuan SPV.`)
    revalidatePath('/dashboard/stock')
    return { success: true, id: transfer.id }
  } catch (err) {
    return fail(err, 'Gagal mengajukan transfer.')
  }
}

export async function approveStockTransfer(id: string, qtyMap: Record<string, number>) {
  const session = await getSession()
  try {
    const t = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true, fromUser: { select: { name: true, areaId: true } }, toUser: { select: { name: true } } },
    })
    if (!t) return { error: 'Transfer tidak ditemukan.' }
    if (!(await canApprove(session, t.fromUser.areaId))) return { error: 'Anda tidak berwenang menyetujui transfer ini.' }
    if (t.status !== 'SUBMITTED') return { error: 'Transfer ini sudah diproses.' }

    const approved = t.items.map(it => ({ id: it.id, qty: Number(qtyMap?.[it.id] ?? it.qtyRequested) }))
    const bad = approved.find((a, i) => !Number.isFinite(a.qty) || a.qty < 0 || a.qty > t.items[i].qtyRequested + 1e-9)
    if (bad) return { error: 'Jumlah disetujui harus antara 0 dan jumlah yang diajukan.' }
    if (approved.every(a => a.qty === 0)) return { error: 'Semua jumlah 0. Gunakan Tolak bila transfer tidak disetujui.' }

    await prisma.$transaction(async (tx) => {
      await transition(tx, id, 'SUBMITTED', { status: 'APPROVED', approvedById: session!.userId, approvedAt: new Date() })
      for (const a of approved) await tx.stockTransferItem.update({ where: { id: a.id }, data: { qtyApproved: a.qty } })
    })

    const revised = approved.some((a, i) => a.qty !== t.items[i].qtyRequested)
    await notify([t.toUserId, t.fromUserId], 'Transfer Stok Disetujui',
      `Transfer dari ${t.fromUser.name} ke ${t.toUser.name} disetujui${revised ? ' dengan jumlah direvisi' : ''}. Penerima perlu konfirmasi terima.`)
    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err) {
    return fail(err, 'Gagal menyetujui transfer.')
  }
}

export async function rejectStockTransfer(id: string, reason: string) {
  const session = await getSession()
  if (!reason?.trim()) return { error: 'Alasan penolakan wajib diisi.' }
  try {
    const t = await prisma.stockTransfer.findUnique({ where: { id }, include: { fromUser: { select: { areaId: true } } } })
    if (!t) return { error: 'Transfer tidak ditemukan.' }
    if (!(await canApprove(session, t.fromUser.areaId))) return { error: 'Anda tidak berwenang menolak transfer ini.' }

    await transition(prisma, id, ['SUBMITTED', 'APPROVED'], { status: 'REJECTED', rejectReason: reason.trim(), approvedById: session!.userId })
    await notify([t.fromUserId, t.toUserId], 'Transfer Stok Ditolak', `Transfer stok ditolak SPV. Alasan: ${reason.trim()}`)
    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err) {
    return fail(err, 'Gagal menolak transfer.')
  }
}

export async function cancelStockTransfer(id: string) {
  const session = await getSession()
  try {
    const t = await prisma.stockTransfer.findUnique({ where: { id }, select: { fromUserId: true } })
    if (!t || t.fromUserId !== session?.userId) return { error: 'Hanya pengirim yang dapat membatalkan transfer ini.' }
    await transition(prisma, id, 'SUBMITTED', { status: 'CANCELLED' })
    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err) {
    return fail(err, 'Gagal membatalkan transfer.')
  }
}

export async function receiveStockTransfer(id: string) {
  const session = await getSession()
  try {
    const t = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        fromUser: { select: { name: true, areaId: true } },
        toUser: { select: { name: true, areaId: true } },
      },
    })
    if (!t || t.toUserId !== session?.userId) return { error: 'Hanya AFA penerima yang dapat mengonfirmasi transfer ini.' }
    if (t.status !== 'APPROVED') return { error: 'Transfer ini belum disetujui atau sudah diproses.' }

    const moves = t.items.filter(it => (it.qtyApproved ?? 0) > 0).map(it => ({ productId: it.productId, qty: it.qtyApproved as number }))
    const held = await findUndecidedUnitProducts(prisma, moves.map(m => m.productId))
    if (held.length > 0) return { error: unitHoldMessage(held) }

    await prisma.$transaction(async (tx) => {
      // Kunci & cek saldo pengirim saat stok benar-benar dipindah (bisa sudah terpakai sejak diajukan)
      await assertStockAvailable(tx, t.fromUserId, moves, SHORTAGE_HINT)
      await transition(tx, id, 'APPROVED', { status: 'RECEIVED', receivedAt: new Date() })
      for (const m of moves) {
        await tx.ledger.create({
          data: {
            userId: t.fromUserId, productId: m.productId, transactionType: 'TRANSFER_ACCOUNT_OUT', quantity: -m.qty,
            referenceId: id, snapshotAreaId: t.fromUser.areaId ?? null,
            notes: `Transfer stok ke ${t.toUser.name} (disetujui SPV, diterima penerima)`,
          },
        })
        await tx.ledger.create({
          data: {
            userId: t.toUserId, productId: m.productId, transactionType: 'TRANSFER_ACCOUNT_IN', quantity: m.qty,
            referenceId: id, snapshotAreaId: t.toUser.areaId ?? null,
            notes: `Transfer stok dari ${t.fromUser.name}`,
          },
        })
      }
    })

    await notify([t.fromUserId, t.approvedById], 'Transfer Stok Diterima',
      `${t.toUser.name} sudah menerima transfer stok dari ${t.fromUser.name}. Stok telah dipindahkan.`)
    revalidatePath('/dashboard/stock')
    return { success: true }
  } catch (err) {
    return fail(err, 'Gagal mengonfirmasi penerimaan.')
  }
}
