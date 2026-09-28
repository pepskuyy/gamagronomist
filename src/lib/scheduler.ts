import { runAccurateSync } from './accurate-sync'
import { runSimotandiSync } from './simotandi-sync'

type JobExecutionState = {
  lastRunDate: string | null
  lastStatus: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  lastError: string | null
  lastRunDurationMs: number | null
}

const state: {
  isInitialized: boolean
  timerId: NodeJS.Timeout | null
  accurateJob: JobExecutionState
  simotandiJob: JobExecutionState
} = {
  isInitialized: false,
  timerId: null,
  accurateJob: {
    lastRunDate: null,
    lastStatus: 'IDLE',
    lastError: null,
    lastRunDurationMs: null,
  },
  simotandiJob: {
    lastRunDate: null,
    lastStatus: 'IDLE',
    lastError: null,
    lastRunDurationMs: null,
  },
}

/**
 * Eksekusi Accurate Master & Stok Sync
 */
async function executeAccurateSyncJob(dateKey: string) {
  if (state.accurateJob.lastStatus === 'RUNNING') {
    console.log('[Scheduler] Accurate Sync sedang berjalan, skip trigger baru.')
    return
  }

  state.accurateJob.lastStatus = 'RUNNING'
  state.accurateJob.lastError = null
  const start = Date.now()
  console.log(`[Scheduler] [${new Date().toISOString()}] Memulai Accurate Sync Harian...`)

  try {
    const result = await runAccurateSync()
    state.accurateJob.lastStatus = 'SUCCESS'
    state.accurateJob.lastRunDate = dateKey
    state.accurateJob.lastRunDurationMs = Date.now() - start
    console.log(
      `[Scheduler] Accurate Sync Berhasil (${state.accurateJob.lastRunDurationMs}ms): ` +
      `${result.updated} updated, ${result.inserted} inserted, ${result.skipped} skipped (Total: ${result.total})`
    )
  } catch (err: any) {
    state.accurateJob.lastStatus = 'ERROR'
    state.accurateJob.lastError = err?.message || 'Unknown error'
    state.accurateJob.lastRunDurationMs = Date.now() - start
    console.error('[Scheduler] Accurate Sync Gagal:', err)
  }
}

/**
 * Eksekusi SIMOTANDI Fase Padi Sync
 */
async function executeSimotandiSyncJob(dateKey: string) {
  if (state.simotandiJob.lastStatus === 'RUNNING') {
    console.log('[Scheduler] SIMOTANDI Sync sedang berjalan, skip trigger baru.')
    return
  }

  state.simotandiJob.lastStatus = 'RUNNING'
  state.simotandiJob.lastError = null
  const start = Date.now()
  console.log(`[Scheduler] [${new Date().toISOString()}] Memulai SIMOTANDI Sync Harian...`)

  try {
    const result = await runSimotandiSync()
    state.simotandiJob.lastStatus = 'SUCCESS'
    state.simotandiJob.lastRunDate = dateKey
    state.simotandiJob.lastRunDurationMs = Date.now() - start
    console.log(
      `[Scheduler] SIMOTANDI Sync Berhasil (${state.simotandiJob.lastRunDurationMs}ms): ` +
      `Periode ${result.periode?.kode} (${result.rowsSaved} baris tersimpan)`
    )
  } catch (err: any) {
    state.simotandiJob.lastStatus = 'ERROR'
    state.simotandiJob.lastError = err?.message || 'Unknown error'
    state.simotandiJob.lastRunDurationMs = Date.now() - start
    console.error('[Scheduler] SIMOTANDI Sync Gagal:', err)
  }
}

/**
 * Evaluasi jadwal setiap menit
 */
function checkSchedule() {
  const now = new Date()
  const utcHours = now.getUTCHours()
  const utcMinutes = now.getUTCMinutes()
  const dateKey = now.toISOString().slice(0, 10) // YYYY-MM-DD

  // 1. Accurate Sync Job: Jadwal 00:00 UTC (07:00 WIB)
  // Berjalan sekali setiap hari pada jam 00:00 - 00:05 UTC
  if (utcHours === 0 && utcMinutes >= 0 && utcMinutes <= 5) {
    if (state.accurateJob.lastRunDate !== dateKey) {
      executeAccurateSyncJob(dateKey).catch((e) =>
        console.error('[Scheduler] Unhandled error in executeAccurateSyncJob:', e)
      )
    }
  }

  // 2. SIMOTANDI Sync Job: Jadwal 22:00 UTC (05:00 WIB)
  // Berjalan sekali setiap hari pada jam 22:00 - 22:05 UTC
  if (utcHours === 22 && utcMinutes >= 0 && utcMinutes <= 5) {
    if (state.simotandiJob.lastRunDate !== dateKey) {
      executeSimotandiSyncJob(dateKey).catch((e) =>
        console.error('[Scheduler] Unhandled error in executeSimotandiSyncJob:', e)
      )
    }
  }
}

/**
 * Inisialisasi background scheduler di dalam proses Node.js
 */
export function startInternalScheduler() {
  if (process.env.ENABLE_INTERNAL_SCHEDULER === 'false') {
    console.log('[Scheduler] Internal scheduler dinonaktifkan via ENABLE_INTERNAL_SCHEDULER=false')
    return
  }

  if (state.isInitialized) {
    return
  }

  state.isInitialized = true
  console.log('[Scheduler] In-process background scheduler diaktifkan.')
  console.log('[Scheduler] - Accurate Sync Job: 00:00 UTC (07:00 WIB)')
  console.log('[Scheduler] - SIMOTANDI Sync Job: 22:00 UTC (05:00 WIB)')

  // Periksa jadwal setiap 60 detik
  state.timerId = setInterval(() => {
    try {
      checkSchedule()
    } catch (err) {
      console.error('[Scheduler] Interval check error:', err)
    }
  }, 60 * 1000)

  // Eksekusi cek pertama kali setelah delay 10 detik agar koneksi DB siap
  setTimeout(() => {
    try {
      checkSchedule()
    } catch (err) {
      console.error('[Scheduler] Initial schedule check error:', err)
    }
  }, 10 * 1000)
}

/**
 * Mendapatkan status scheduler saat ini
 */
export function getSchedulerStatus() {
  return {
    isInitialized: state.isInitialized,
    accurateJob: { ...state.accurateJob },
    simotandiJob: { ...state.simotandiJob },
  }
}
