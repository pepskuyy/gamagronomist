/**
 * Reverse geocoding menggunakan OpenStreetMap Nominatim (gratis, tanpa API key).
 * Mengembalikan nama kabupaten/kota dalam lowercase & normalized.
 */
export async function getKabupatenFromCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=id`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Gamagronomist/1.0 (contact@gamagronomist.id)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = await res.json()

    const addr = data.address || {}
    // Nominatim mengembalikan county / city / district - kita prioritaskan county (kabupaten)
    const raw =
      addr.county ||         // "Kabupaten Grobogan"
      addr.city ||           // "Kota Semarang"
      addr.town ||
      addr.municipality ||
      addr.district ||
      null

    if (!raw) return null
    // Normalize: lowercase, hapus prefix "kabupaten " / "kota " agar matching lebih fleksibel
    return raw.toLowerCase().trim()
  } catch {
    return null
  }
}

/**
 * Coba normalisasi: hapus prefix "kabupaten" / "kota" untuk matching fleksibel.
 */
export function normalizeKabupaten(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(kabupaten|kota)\s+/, '')  // hapus prefix
}
