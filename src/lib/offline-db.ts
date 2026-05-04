/**
 * offline-db.ts
 * IndexedDB wrapper untuk menyimpan draft laporan offline.
 * Menggunakan library 'idb' (lightweight IndexedDB wrapper).
 */

import { openDB, IDBPDatabase } from 'idb'

const DB_NAME = 'agrolens-offline'
const DB_VERSION = 1
const STORE = 'pending-reports'

export type ReportType = 'spot-demplot' | 'cb' | 'kios' | 'gathering' | 'company' | 'video-konten'
export type DraftStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface PhotoBlob {
  blob: Blob
  filename: string
  mimeType: string
  previewUrl?: string // createObjectURL — hanya valid di session ini
}

export interface PendingDraft {
  id: string
  type: ReportType
  formData: Record<string, any>
  photoBlobs: PhotoBlob[]
  status: DraftStatus
  createdAt: string
  syncedAt?: string
  errorMsg?: string
}

let _db: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('status', 'status')
        store.createIndex('type', 'type')
        store.createIndex('createdAt', 'createdAt')
      }
    },
  })
  return _db
}

/** Simpan draft baru ke IndexedDB */
export async function saveDraft(
  type: ReportType,
  formData: Record<string, any>,
  photoBlobs: PhotoBlob[]
): Promise<string> {
  const db = await getDB()
  const id = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const draft: PendingDraft = {
    id,
    type,
    formData,
    photoBlobs,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  await db.put(STORE, draft)
  return id
}

/** Ambil semua draft yang masih pending */
export async function getPendingDrafts(): Promise<PendingDraft[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.filter(d => d.status === 'pending' || d.status === 'failed')
}

/** Ambil SEMUA draft (untuk halaman antrian) */
export async function getAllDrafts(): Promise<PendingDraft[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Ambil satu draft by ID */
export async function getDraft(id: string): Promise<PendingDraft | undefined> {
  const db = await getDB()
  return db.get(STORE, id)
}

/** Update status draft */
export async function updateDraftStatus(
  id: string,
  status: DraftStatus,
  errorMsg?: string
): Promise<void> {
  const db = await getDB()
  const draft = await db.get(STORE, id)
  if (!draft) return
  draft.status = status
  if (status === 'synced') draft.syncedAt = new Date().toISOString()
  if (errorMsg) draft.errorMsg = errorMsg
  await db.put(STORE, draft)
}

/** Hapus draft by ID */
export async function deleteDraft(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

/** Hitung jumlah draft pending */
export async function countPendingDrafts(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.filter(d => d.status === 'pending' || d.status === 'failed').length
}
