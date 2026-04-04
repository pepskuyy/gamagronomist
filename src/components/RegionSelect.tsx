'use client'

import { useState, useEffect } from 'react'
import { getRegencies, getDistricts, getVillages } from '@/app/actions/region'
import SearchableSelect from './SearchableSelect'

type Region = { id: string; name: string }

interface RegionSelectProps {
  required?: boolean
  initialKabupaten?: string
  initialKecamatan?: string
  initialDesa?: string
  // If provided, calls back with the full concatenated string "Desa X, Kec Y, Kabupaten Z"
  onChangeFullString?: (fullStr: string) => void
  // Optional field names for raw form submission
  nameKabupaten?: string
  nameKecamatan?: string
  nameDesa?: string
}

export default function RegionSelect({
  required = true,
  initialKabupaten = '',
  initialKecamatan = '',
  initialDesa = '',
  onChangeFullString,
  nameKabupaten,
  nameKecamatan,
  nameDesa
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

  // 1. Fetch Kabupaten (Regencies)
  useEffect(() => {
    getRegencies(PROVINCE_ID).then(data => {
      setKabupatens(data)
      if (initialKabupaten) {
        const found = data.find((d: Region) => d.name === initialKabupaten)
        if (found) setSelectedKabId(found.id)
      }
    }).catch(console.error)
  }, [initialKabupaten])

  // 2. Fetch Kecamatan (Districts) when Kabupaten selected
  useEffect(() => {
    if (!selectedKabId) {
      setKecamatans([])
      setSelectedKecId('')
      setKecName('')
      return
    }
    getDistricts(selectedKabId).then(data => {
      setKecamatans(data)
      if (initialKecamatan && data.find((d: Region) => d.name === initialKecamatan)) {
        const found = data.find((d: Region) => d.name === initialKecamatan)
        if (found) setSelectedKecId(found.id)
      } else {
        setSelectedKecId('')
        setKecName('')
      }
    }).catch(console.error)
  }, [selectedKabId, initialKecamatan])

  // 3. Fetch Desa (Villages) when Kecamatan selected
  useEffect(() => {
    if (!selectedKecId) {
      setDesas([])
      setSelectedDesaId('')
      setDesaName('')
      return
    }
    getVillages(selectedKecId).then(data => {
      setDesas(data)
      if (initialDesa && data.find((d: Region) => d.name === initialDesa)) {
        const found = data.find((d: Region) => d.name === initialDesa)
        if (found) setSelectedDesaId(found.id)
      } else {
        setSelectedDesaId('')
        setDesaName('')
      }
    }).catch(console.error)
  }, [selectedKecId, initialDesa])

  // Call onChangeFullString whenever the string changes completely
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
      {/* Hidden inputs if native form submission is used */}
      {nameKabupaten && <input type="hidden" name={nameKabupaten} value={kabName} />}
      {nameKecamatan && <input type="hidden" name={nameKecamatan} value={kecName} />}
      {nameDesa && <input type="hidden" name={nameDesa} value={desaName} />}

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Kabupaten / Kota {required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
        <SearchableSelect
          options={kabupatens.map(k => ({ value: k.id, label: k.name }))}
          value={selectedKabId}
          onChange={handleKabChange}
          required={required}
          placeholder="-- Pilih Kabupaten --"
        />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Kecamatan {required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
        {selectedKabId ? (
          <SearchableSelect
            options={kecamatans.map(k => ({ value: k.id, label: k.name }))}
            value={selectedKecId}
            onChange={handleKecChange}
            required={required}
            placeholder="-- Pilih Kecamatan --"
          />
        ) : (
          <select className="form-control" disabled required={required}>
            <option value="">-- Pilih Kabupaten Dulu --</option>
          </select>
        )}
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Desa / Kelurahan {required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
        {selectedKecId ? (
          <SearchableSelect
            options={desas.map(k => ({ value: k.id, label: k.name }))}
            value={selectedDesaId}
            onChange={handleDesaChange}
            required={required}
            placeholder="-- Pilih Desa --"
          />
        ) : (
          <select className="form-control" disabled required={required}>
            <option value="">-- Pilih Kecamatan Dulu --</option>
          </select>
        )}
      </div>
    </div>
  )
}
