/**
 * Helper URL thumbnail Cloudinary.
 *
 * Foto lapangan disimpan dengan URL berisi transformasi
 * `c_limit,w_1280,h_1280,q_78,f_auto` (lihat src/app/api/upload/route.ts),
 * sehingga thumbnail kecil (avatar 36px, galeri 150px) tetap mengunduh varian
 * 1280px. Helper ini menghasilkan varian kecil untuk tampilan thumbnail.
 *
 * Aman: URL non-Cloudinary, blob:, data:, atau bukan /image/upload/
 * dikembalikan apa adanya. Link "lihat foto penuh" tetap memakai URL asli.
 */

const UPLOAD_MARKER = '/image/upload/'
// Transformasi default dari /api/upload — dibuang agar tidak di-chain dua kali
const DEFAULT_TRANSFORM = 'c_limit,w_1280,h_1280,q_78,f_auto/'

export function cldThumb(url: string | null | undefined, width: number, height: number = width): string {
  if (!url) return ''
  if (!url.startsWith('https://res.cloudinary.com/')) return url
  const idx = url.indexOf(UPLOAD_MARKER)
  if (idx === -1) return url

  const prefix = url.slice(0, idx + UPLOAD_MARKER.length)
  let rest = url.slice(idx + UPLOAD_MARKER.length)
  if (rest.startsWith(DEFAULT_TRANSFORM)) rest = rest.slice(DEFAULT_TRANSFORM.length)

  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return `${prefix}c_fill,g_auto,w_${w},h_${h},q_auto,f_auto/${rest}`
}
