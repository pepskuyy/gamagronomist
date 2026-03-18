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
    return await res.json()
  } catch (err) {
    console.error('getVillages error', err)
    return []
  }
}
