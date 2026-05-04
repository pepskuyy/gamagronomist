'use client'

/**
 * RegionSelect — Hybrid Online/Offline
 *
 * Strategi:
 * 1. Online  → panggil server action (fetch di sisi server, tidak ada CORS issue)
 *              → simpan hasil ke localStorage sebagai cache offline
 * 2. Offline → gunakan localStorage cache (data yg sudah pernah diambil)
 * 3. Offline tanpa cache → tampilkan kosong + pesan info
 */

import { useState, useEffect } from 'react'
import { getRegencies, getDistricts, getVillages } from '@/app/actions/region'
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

// ── localStorage cache helpers ─────────────────────────────────────
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 hari

function lsGet(key: string): Region[] | null {
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

function lsSet(key: string, data: Region[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // Ignore QuotaExceededError
  }
}

// ── Fetch dengan cache ─────────────────────────────────────────────

async function cachedGetRegencies(provinceId: string): Promise<Region[]> {
  const key = `region_regencies_${provinceId}`
  const cached = lsGet(key)
  if (cached && cached.length > 0) return cached

  try {
    const data: Region[] = await getRegencies(provinceId)
    if (data.length > 0) lsSet(key, data)
    return data
  } catch {
    return lsGet(key) || []
  }
}

async function cachedGetDistricts(regencyId: string): Promise<Region[]> {
  const key = `region_districts_${regencyId}`
  const cached = lsGet(key)
  if (cached && cached.length > 0) return cached

  try {
    const data: Region[] = await getDistricts(regencyId)
    if (data.length > 0) lsSet(key, data)
    return data
  } catch {
    return lsGet(key) || []
  }
}

async function cachedGetVillages(districtId: string): Promise<Region[]> {
  const key = `region_villages_${districtId}`
  const cached = lsGet(key)
  if (cached && cached.length > 0) return cached

  try {
    const data: Region[] = await getVillages(districtId)
    if (data.length > 0) lsSet(key, data)
    return data
  } catch {
    return lsGet(key) || []
  }
}

// ── Komponen ───────────────────────────────────────────────────────

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
  const [loadingKab, setLoadingKab] = useState(true)
  const [loadingKec, setLoadingKec] = useState(false)
  const [loadingDesa, setLoadingDesa] = useState(false)

  // Deteksi koneksi
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
    setLoadingKab(true)
    cachedGetRegencies(PROVINCE_ID).then(data => {
      setKabupatens(data)
      setLoadingKab(false)
      if (initialKabupaten) {
        const found = data.find((d: Region) => d.name === initialKabupaten)
        if (found) setSelectedKabId(found.id)
      }
    })
  }, [initialKabupaten])

  // 2. Fetch Kecamatan
  useEffect(() => {
    if (!selectedKabId) {
      setKecamatans([])
      setSelectedKecId('')
      setKecName('')
      return
    }
    setLoadingKec(true)
    cachedGetDistricts(selectedKabId).then(data => {
      setKecamatans(data)
      setLoadingKec(false)
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

  // 3. Fetch Desa
  useEffect(() => {
    if (!selectedKecId) {
      setDesas([])
      setSelectedDesaId('')
      setDesaName('')
      return
    }
    setLoadingDesa(true)
    cachedGetVillages(selectedKecId).then(data => {
      setDesas(data)
      setLoadingDesa(false)
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
      {/* Indikator offline dengan cache kosong */}
      {isOffline && !loadingKab && kabupatens.length === 0 && (
        <div style={{
          fontSize: '0.78rem', color: '#92400e',
          background: '#fef3c7', border: '1px solid #fde68a',
          borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
          marginBottom: '0.5rem'
        }}>
          📵 Offline — Data wilayah belum ter-cache. Buka halaman ini sekali saat ada sinyal agar tersimpan untuk penggunaan offline.
        </div>
      )}
      {isOffline && kabupatens.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>
          📵 Menggunakan data wilayah dari cache lokal
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
            placeholder={loadingKab ? '⏳ Memuat...' : '-- Pilih Kabupaten --'}
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
              placeholder={loadingKec ? '⏳ Memuat...' : kecamatans.length === 0 ? '(Tidak ada data)' : '-- Pilih Kecamatan --'}
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
              placeholder={loadingDesa ? '⏳ Memuat...' : desas.length === 0 ? '(Tidak ada data)' : '-- Pilih Desa --'}
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
