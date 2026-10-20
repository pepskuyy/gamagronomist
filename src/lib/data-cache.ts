import { unstable_cache, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'

/**
 * Cache server-side (Next.js Data Cache) untuk data master yang jarang berubah
 * dan TIDAK bergantung pada user/role. Auth tetap dicek di route handler,
 * di luar fungsi cache.
 *
 * Invalidasi:
 *  - Eksplisit via invalidateCacheTag() di setiap titik mutasi.
 *  - TTL (`revalidate`) sebagai jaring pengaman bila ada mutasi yang
 *    tidak memanggil invalidasi (mis. script lokal / SQL manual).
 */

export const CACHE_TAGS = {
  simotandi: 'simotandi',
  stores: 'stores',
  products: 'products',
} as const

type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

/**
 * revalidateTag yang aman dipanggil dari konteks mana pun (server action,
 * route handler, maupun scheduler in-process). Kegagalan invalidasi tidak
 * boleh menggagalkan mutasi data — TTL tetap menjadi fallback.
 */
export function invalidateCacheTag(...tags: CacheTag[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag)
    } catch (err) {
      console.warn(`[data-cache] revalidateTag('${tag}') gagal, fallback ke TTL:`, (err as Error)?.message)
    }
  }
}

// ── SIMOTANDI (sinkron harian) ────────────────────────────────────

const SIMOTANDI_SELECT = {
  level: true,
  nama: true,
  kdpr: true,
  kdkb: true,
  kdkc: true,
  bera: true,
  penyiapanLahan: true,
  tanam: true,
  veg1: true,
  veg2: true,
  gen1: true,
  gen2: true,
  panen: true,
  standingCrop: true,
  lsb: true,
} as const

export const getSimotandiPeriods = unstable_cache(
  async () =>
    prisma.simotandiPeriode.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, kode: true, label: true, startDate: true, endDate: true },
    }),
  ['simotandi-periods-v1'],
  { tags: [CACHE_TAGS.simotandi], revalidate: 3600 }
)

export const getLatestSimotandiPeriodeId = unstable_cache(
  async () =>
    (
      await prisma.simotandiPeriode.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true },
      })
    )?.id ?? null,
  ['simotandi-latest-periode-v1'],
  { tags: [CACHE_TAGS.simotandi], revalidate: 3600 }
)

/** Key cache otomatis menyertakan argumen (periode, kdkb). */
export const getSimotandiData = unstable_cache(
  async (periode: number, kdkb: string | null) => {
    const [periodeInfo, provinsi, kabupaten, kecamatan] = await Promise.all([
      prisma.simotandiPeriode.findUnique({
        where: { id: periode },
        select: { id: true, kode: true, label: true, startDate: true, endDate: true },
      }),
      prisma.simotandiWilayah.findMany({ where: { periodeId: periode, level: 'provinsi' }, select: SIMOTANDI_SELECT }),
      prisma.simotandiWilayah.findMany({
        where: { periodeId: periode, level: 'kabupaten' },
        select: SIMOTANDI_SELECT,
        orderBy: { kdkb: 'asc' },
      }),
      kdkb
        ? prisma.simotandiWilayah.findMany({
            where: { periodeId: periode, level: 'kecamatan', kdkb },
            select: SIMOTANDI_SELECT,
            orderBy: { kdkc: 'asc' },
          })
        : Promise.resolve([]),
    ])
    return { periode: periodeInfo, provinsi, kabupaten, kecamatan }
  },
  ['simotandi-data-v1'],
  { tags: [CACHE_TAGS.simotandi], revalidate: 3600 }
)

// ── Master toko ───────────────────────────────────────────────────

export const getAllStores = unstable_cache(
  async () => prisma.store.findMany({ orderBy: { name: 'asc' } }),
  ['stores-all-v1'],
  { tags: [CACHE_TAGS.stores], revalidate: 600 }
)

// ── Master produk (dipakai form, termasuk offline via SW) ─────────

export const getProductOptions = unstable_cache(
  async () =>
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        unitGramasi: true,
        gramasiPerUnit: true,
      },
      orderBy: { name: 'asc' },
    }),
  ['products-options-v1'],
  { tags: [CACHE_TAGS.products], revalidate: 300 }
)
