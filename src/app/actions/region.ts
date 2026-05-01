'use server'

const BASE_URL = 'https://emsifa.github.io/api-wilayah-indonesia/api'

export async function getRegencies(provinceId: string) {
  try {
    const res = await fetch(`${BASE_URL}/regencies/${provinceId}.json`, { cache: 'force-cache' })
    if (!res.ok) return []
    return await res.json()
  } catch (err) {
    console.error('getRegencies error', err)
    return []
  }
}

export async function getDistricts(regencyId: string) {
  try {
    const res = await fetch(`${BASE_URL}/districts/${regencyId}.json`, { cache: 'force-cache' })
    if (!res.ok) return []
    return await res.json()
  } catch (err) {
    console.error('getDistricts error', err)
    return []
  }
}

export async function getVillages(districtId: string) {
  try {
    const res = await fetch(`${BASE_URL}/villages/${districtId}.json`, { cache: 'force-cache' })
    if (!res.ok) return []
    const data: any[] = await res.json()
    
    // PATCH: Desa Brumbung tidak ada di API Emsifa untuk Kecamatan Mranggen (Demak)
    // ID Mranggen adalah '3321010'. Kita tambahkan secara manual.
    if (districtId === '3321010') {
      if (!data.find(v => v.name === 'BRUMBUNG')) {
        data.push({ id: '3321010999', name: 'BRUMBUNG', district_id: '3321010' })
        
        // Sort agar berurutan sesuai alfabet
        data.sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    return data
  } catch (err) {
    console.error('getVillages error', err)
    return []
  }
}
