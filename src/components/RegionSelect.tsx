'use client'

import { useState, useEffect } from 'react'
import SearchableSelect from './SearchableSelect'

type Region = { id: string; name: string }

interface RegionSelectProps {
  required?: boolean
  initialKabupaten?: string
  initialKecamatan?: string
  initialDesa?: string
  onChangeFullString?: (fullStr: string) => void
  nameKabupaten?: string
  nameKecamatan?: string
  nameDesa?: string
}

// ── Patch lokal: desa yang hilang dari API EMSIFA ─────────────────
const VILLAGE_PATCHES: Record<string, Region[]> = {
  '3321010': [{ id: '3321010999', name: 'BRUMBUNG' }], // Mranggen, Demak
}

const EMSIFA_BASE = 'https://emsifa.github.io/api-wilayah-indonesia/api'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari

// ── localStorage helpers ──────────────────────────────────────────
function cacheGet(key: string): Region[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return data as Region[]
  } catch {
    return null
  }
}

function cacheSet(key: string, data: Region[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // Ignore QuotaExceededError
  }
}

// ── Fetch wilayah langsung dari EMSIFA (bisa offline jika SW cache) ──
async function fetchRegions(url: string, cacheKey: string): Promise<Region[]> {
  // 1. Coba dari localStorage cache
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  // 2. Fetch dari EMSIFA API (langsung dari browser, bukan server action)
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: Region[] = await res.json()
    cacheSet(cacheKey, data)
    return data
  } catch {
    // 3. Jika gagal (offline), kembalikan array kosong
    return []
  }
}

async function fetchRegencies(provinceId: string): Promise<Region[]> {
  return fetchRegions(
    `${EMSIFA_BASE}/regencies/${provinceId}.json`,
    `region_regencies_${provinceId}`
  )
}

async function fetchDistricts(regencyId: string): Promise<Region[]> {
  return fetchRegions(
    `${EMSIFA_BASE}/districts/${regencyId}.json`,
    `region_districts_${regencyId}`
  )
}

async function fetchVillages(districtId: string): Promise<Region[]> {
  const data = await fetchRegions(
    `${EMSIFA_BASE}/villages/${districtId}.json`,
    `region_villages_${districtId}`
  )

  // Terapkan patch lokal jika ada
  const patches = VILLAGE_PATCHES[districtId] || []
  const patched = [...data]
  for (const patch of patches) {
    if (!patched.find(v => v.name === patch.name)) {
      patched.push({ ...patch, id: patch.id })
    }
  }
  patched.sort((a, b) => a.name.localeCompare(b.name))

  // Update cache dengan data yang sudah di-patch
  if (patches.length > 0) {
    cacheSet(`region_villages_${districtId}`, patched)
  }

  return patched
}

// ── Komponen Utama ────────────────────────────────────────────────
export default function RegionSelect({
  required = true,
  initialKabupaten = '',
  initialKecamatan = '',
  initialDesa = '',
  onChangeFullString,
  nameKabupaten,
  nameKecamatan,
  nameDesa,
}: RegionSelectProps) {
  const PROVINCE_ID = '33' // Jawa Tengah

  const [kabupatens, setKabupatens] = useState<Region[]>([])
  const [kecamatans, setKecamatans] = useState<Region[]>([])
  const [desas, setDesas] = useState<Region[]>([])

  const [selectedKabId, setSelectedKabId] = useState('')
  const [selectedKecId, setSelectedKecId] = useState('')
  const [selectedDesaId, setSelectedDesaId] = useState('')

  const [kabName, setKabName] = useState(initialKabupaten)
  const [kecName, setKecName] = useState(initialKecamatan)
  const [desaName, setDesaName] = useState(initialDesa)

  const [isOffline, setIsOffline] = useState(false)

  // Deteksi status koneksi
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // 1. Fetch Kabupaten
  useEffect(() => {
    fetchRegencies(PROVINCE_ID).then(data => {
      setKabupatens(data)
      if (initialKabupaten) {
        const found = data.find((d: Region) => d.name === initialKabupaten)
        if (found) setSelectedKabId(found.id)
      }
    })
  }, [initialKabupaten])

  // 2. Fetch Kecamatan saat Kabupaten dipilih
  useEffect(() => {
    if (!selectedKabId) {
      setKecamatans([])
      setSelectedKecId('')
      setKecName('')
      return
    }
    fetchDistricts(selectedKabId).then(data => {
      setKecamatans(data)
      if (initialKecamatan) {
        const found = data.find((d: Region) => d.name === initialKecamatan)
        if (found) {
          setSelectedKecId(found.id)
        } else {
          setSelectedKecId('')
          setKecName('')
        }
      } else {
        setSelectedKecId('')
        setKecName('')
      }
    })
  }, [selectedKabId, initialKecamatan])

  // 3. Fetch Desa saat Kecamatan dipilih
  useEffect(() => {
    if (!selectedKecId) {
      setDesas([])
      setSelectedDesaId('')
      setDesaName('')
      return
    }
    fetchVillages(selectedKecId).then(data => {
      setDesas(data)
      if (initialDesa) {
        const found = data.find((d: Region) => d.name === initialDesa)
        if (found) {
          setSelectedDesaId(found.id)
        } else {
          setSelectedDesaId('')
          setDesaName('')
        }
      } else {
        setSelectedDesaId('')
        setDesaName('')
      }
    })
  }, [selectedKecId, initialDesa])

  // Callback onChangeFullString
  useEffect(() => {
    if (onChangeFullString) {
      if (kabName && kecName && desaName) {
        onChangeFullString(`Desa ${desaName}, Kec. ${kecName}, ${kabName}`)
      } else {
        onChangeFullString('')
      }
    }
  }, [kabName, kecName, desaName, onChangeFullString])

  const handleKabChange = (id: string) => {
    setSelectedKabId(id)
    const found = kabupatens.find(x => x.id === id)
    setKabName(found ? found.name : '')
  }

  const handleKecChange = (id: string) => {
    setSelectedKecId(id)
    const found = kecamatans.find(x => x.id === id)
    setKecName(found ? found.name : '')
  }

  const handleDesaChange = (id: string) => {
    setSelectedDesaId(id)
    const found = desas.find(x => x.id === id)
    setDesaName(found ? found.name : '')
  }

  return (
    <div>
      {/* Indikator offline — hanya muncul jika data kosong saat offline */}
      {isOffline && kabupatens.length === 0 && (
        <div style={{
          fontSize: '0.78rem', color: '#92400e',
          background: '#fef3c7', border: '1px solid #fde68a',
          borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem',
          marginBottom: '0.5rem'
        }}>
          📵 Offline — Data wilayah akan muncul dari cache. Pilih kabupaten terlebih dahulu untuk koneksi berikutnya agar ter-cache.
        </div>
      )}
      {isOffline && kabupatens.length > 0 && (
        <div style={{
          fontSize: '0.75rem', color: '#64748b',
          marginBottom: '0.4rem'
        }}>
          📵 Menggunakan data wilayah dari cache lokal
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {/* Hidden inputs */}
        {nameKabupaten && <input type="hidden" name={nameKabupaten} value={kabName} />}
        {nameKecamatan && <input type="hidden" name={nameKecamatan} value={kecName} />}
        {nameDesa && <input type="hidden" name={nameDesa} value={desaName} />}

        {/* Kabupaten */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Kabupaten / Kota {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </label>
          <SearchableSelect
            options={kabupatens.map(k => ({ value: k.id, label: k.name }))}
            value={selectedKabId}
            onChange={handleKabChange}
            required={required}
            placeholder={kabupatens.length === 0 ? '(Memuat...)' : '-- Pilih Kabupaten --'}
          />
        </div>

        {/* Kecamatan */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Kecamatan {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </label>
          {selectedKabId ? (
            <SearchableSelect
              options={kecamatans.map(k => ({ value: k.id, label: k.name }))}
              value={selectedKecId}
              onChange={handleKecChange}
              required={required}
              placeholder={kecamatans.length === 0 ? '(Memuat...)' : '-- Pilih Kecamatan --'}
            />
          ) : (
            <select className="form-control" disabled required={required}>
              <option value="">-- Pilih Kabupaten Dulu --</option>
            </select>
          )}
        </div>

        {/* Desa */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Desa / Kelurahan {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </label>
          {selectedKecId ? (
            <SearchableSelect
              options={desas.map(k => ({ value: k.id, label: k.name }))}
              value={selectedDesaId}
              onChange={handleDesaChange}
              required={required}
              placeholder={desas.length === 0 ? '(Memuat...)' : '-- Pilih Desa --'}
            />
          ) : (
            <select className="form-control" disabled required={required}>
              <option value="">-- Pilih Kecamatan Dulu --</option>
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
