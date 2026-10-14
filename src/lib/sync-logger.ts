import prisma from '@/lib/prisma'

export interface SyncLogEntry {
  id: string
  dataType: string
  triggerType: 'MANUAL' | 'OTOMATIS'
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  processedCount: number
  message: string | null
  errorDetail: string | null
  durationMs: number | null
  startedAt: Date
  finishedAt: Date | null
  createdAt: Date
}

/**
 * Mencatat awal proses sinkronisasi (Status: RUNNING)
 */
export async function startSyncLog(params: {
  dataType: string
  triggerType?: 'MANUAL' | 'OTOMATIS'
  message?: string
}): Promise<string | null> {
  const trigger = params.triggerType || 'MANUAL'
  const startedAt = new Date()

  try {
    const log = await prisma.syncLog.create({
      data: {
        dataType: params.dataType,
        triggerType: trigger,
        status: 'RUNNING',
        processedCount: 0,
        message: params.message || 'Sinkronisasi sedang diproses...',
        startedAt,
      },
    })
    return log.id
  } catch (err: any) {
    console.warn('[SyncLogger] Gagal membuat sync log awal (tabel mungkin belum dibuat di Supabase):', err?.message)
    return null
  }
}

/**
 * Memperbarui log ketika sinkronisasi BERHASIL
 */
export async function completeSyncLog(
  logId: string | null,
  params: {
    processedCount: number
    message: string
    durationMs?: number
  }
) {
  if (!logId) return
  const finishedAt = new Date()

  try {
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: 'SUCCESS',
        processedCount: params.processedCount,
        message: params.message,
        durationMs: params.durationMs,
        finishedAt,
      },
    })
  } catch (err: any) {
    console.warn('[SyncLogger] Gagal update sync log success:', err?.message)
  }
}

/**
 * Memperbarui log ketika sinkronisasi GAGAL
 */
export async function failSyncLog(
  logId: string | null,
  params: {
    error: any
    message?: string
    durationMs?: number
  }
) {
  if (!logId) return
  const finishedAt = new Date()
  const errorText = typeof params.error === 'string'
    ? params.error
    : (params.error?.message || JSON.stringify(params.error))

  try {
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        message: params.message || 'Sinkronisasi gagal diproses.',
        errorDetail: errorText,
        durationMs: params.durationMs,
        finishedAt,
      },
    })
  } catch (err: any) {
    console.warn('[SyncLogger] Gagal update sync log failed:', err?.message)
  }
}

/**
 * Mencatat hasil sinkronisasi secara instan (atomic)
 */
export async function recordSyncLog(params: {
  dataType: string
  triggerType?: 'MANUAL' | 'OTOMATIS'
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  processedCount: number
  message: string
  errorDetail?: string | null
  durationMs?: number | null
  startedAt?: Date
  finishedAt?: Date
}) {
  try {
    await prisma.syncLog.create({
      data: {
        dataType: params.dataType,
        triggerType: params.triggerType || 'MANUAL',
        status: params.status,
        processedCount: params.processedCount,
        message: params.message,
        errorDetail: params.errorDetail || null,
        durationMs: params.durationMs || null,
        startedAt: params.startedAt || new Date(),
        finishedAt: params.finishedAt || new Date(),
      },
    })
  } catch (err: any) {
    console.warn('[SyncLogger] Gagal mencatat record sync log:', err?.message)
  }
}

/**
 * Mengambil daftar riwayat log sinkronisasi
 */
export async function getRecentSyncLogs(limit: number = 100, page: number = 1) {
  try {
    const skip = (page - 1) * limit
    const [total, logs] = await Promise.all([
      prisma.syncLog.count(),
      prisma.syncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip,
      }),
    ])

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
    }
  } catch (err: any) {
    console.warn('[SyncLogger] Gagal mengambil sync logs:', err?.message)
    return {
      total: 0,
      page: 1,
      limit,
      totalPages: 0,
      logs: [],
    }
  }
}
