'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import RegionSelect from '@/components/RegionSelect'
import GpsCapture from '@/components/GpsCapture'
import { submitCustomerBehavior } from '@/app/actions/report'
import { useOfflineDraft } from '@/hooks/useOfflineDraft'
import type { PhotoBlob } from '@/lib/offline-db'

// ── Dropdown options ──────────────────────────────────────────────
const OPT_DATA = {
  Hama: [
    'Ulat Grayak', 'Ulat Buah', 'Ulat Tanah', 'Ulat Pelipat Daun', 'Ulat Krop', 'Uret',
    'Penggerek Batang (Sundep/Beluk)', 'Penggerek Umbi', 'Kutu Daun', 'Tungau (Acarina)',
    'Thrips', 'Wereng Batang Coklat', 'Wereng Hijau', 'Walang Sangit (Lembing)', 'Kepik',
    'Belalang', 'Lalat Buah', 'Lalat Pengorok Daun', 'Keong/Bekicot', 'Burung Pipit',
    'Tikus', 'Kelelawar', 'Babi Hutan', 'Nematoda'
  ],
  Penyakit: [
    'Hawar Daun Bakteri (kresek)', 'Blas/Patah Leher', 'Tungro', 'Hawar Pelepah',
    'Gosong Palsu (oncom)', 'Bulai', 'Bercak Daun', 'Hawar Daun', 'Layu Fusarium',
    'Layu Bakteri', 'Busuk Batang', 'Antraknosa/Patek', 'Karat Daun', 'Cacar Daun',
    'Bercak Ungu', 'Mati Pucuk', 'Busuk Buah', 'Akar Gada', 'Geminivirus/Bule'
  ],
  Gulma: [
    'Daun Sempit (Rerumputan)', 'Daun Lebar', 'Teki-tekian', 'Paku-pakuan (Pakis)',
    'Lulangan', 'Berkayu/Semak'
  ]
}

const COMMODITIES = [
  'Cabai', 'Bawang Merah', 'Padi', 'Jagung', 'Tomat', 'Semangka',
  'Tembakau', 'Tebu', 'Kentang', 'Kubis', 'Terong', 'Sawi'
]

const PRODUCT_BRANDS = [
  'ADVANTA', 'AGRICON', 'BASF', 'BAYER', 'BIOTIS', 'BISI', 'CORTEVA',
  'DGW', 'FMC', 'KAPAL TERBANG', 'MMI', 'NUFARM', 'ORGANIK',
  'PETROSIDA GRESIK', 'POLARCHEM', 'SAKA SAKI', 'SAPROTAN UTAMA',
  'SINAMYANG', 'SYNGENTA'
]

const REFERENCES = ['Pengalaman', 'Media Sosial', 'Kelompok Tani', 'Keluarga']

const CONSTRAINTS = [
  'Tidak ada kendala', 'Kelebihan dosis urea', 'pH tanah rendah', 'Tanah ambles / lunak',
  'Stres herbisida', 'Kebanjiran', 'Kekurangan air', 'Belum paham penggunaan obat/pestisida',
  'Tanah kapur', 'Tenaga kerja mahal', 'Pilihan komoditas terbatas', 'Tanah lempung / lengket',
  'Tanah keras', 'Banyak garapan', 'Drainase buruk', 'Lahan susah kering',
  'Pertumbuhan/keluarnya bulir tidak serempak', 'Harga jual murah', 'Modal tinggi',
  'Jumlah anakan sedikit', 'Tanah tidak subur', 'Obat/pestisida mahal', 'Hujan',
  'Angin kencang', 'Tanaman ambruk', 'Pupuk sulit didapat'
]

// ── Reusable multi-chip selector ──────────────────────────────────
function MultiChip({
  options, selected, onToggle, otherValue, onOtherChange, otherLabel = 'Lainnya...'
}: {
  options: string[]
  selected: string[]
  onToggle: (val: string) => void
  otherValue: string
  onOtherChange: (val: string) => void
  otherLabel?: string
}) {
  const hasOther = selected.includes('Lainnya')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onToggle(opt)}
          style={{
            padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
            border: selected.includes(opt) ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected.includes(opt) ? 'var(--primary-light)' : 'var(--surface-hover)',
            color: selected.includes(opt) ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.15s'
          }}>
          {selected.includes(opt) ? '✓ ' : ''}{opt}
        </button>
      ))}
      {/* Lainnya chip */}
      <button type="button" onClick={() => onToggle('Lainnya')}
        style={{
          padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
          border: hasOther ? '2px solid var(--secondary)' : '1px solid var(--border)',
          background: hasOther ? '#f0fdf4' : 'var(--surface-hover)',
          color: hasOther ? '#16a34a' : 'var(--text-muted)',
          transition: 'all 0.15s'
        }}>
        {hasOther ? '✓ Lainnya' : '+ Lainnya'}
      </button>
      {hasOther && (
        <input type="text" className="form-control" value={otherValue} onChange={e => onOtherChange(e.target.value)}
          placeholder={otherLabel} style={{ marginTop: '0.5rem', width: '100%' }} />
      )}
    </div>
  )
}

// ── Main Form ────────────────────────────────────────────────
const NewCustomerBehaviorRef = () => {
  const router = useRouter()
  const { isOnline, saveDraft } = useOfflineDraft('cb')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOffline, setSavedOffline] = useState(false)

  // OPT state
  const [selectedOptTypes, setSelectedOptTypes] = useState<string[]>([])
  const [selectedOptDetails, setSelectedOptDetails] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [photoBlobs, setPhotoBlobs] = useState<PhotoBlob[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [hasPhone, setHasPhone] = useState(true)

  // Extra state for offline draft capture
  const [farmerName, setFarmerName] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [totalLandArea, setTotalLandArea] = useState('')
  const [totalLandAreaUnit, setTotalLandAreaUnit] = useState('ha')
  const [reasonChoice, setReasonChoice] = useState('')
  const [buyLocation, setBuyLocation] = useState('')
  const [buyReason, setBuyReason] = useState('')
  const [notes, setNotes] = useState('')
  // Region
  const [district, setDistrict] = useState('')
  const [districtKec, setDistrictKec] = useState('')
  const [districtDesa, setDistrictDesa] = useState('')

  // Commodity multi-chip
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([])
  const [commodityOther, setCommodityOther] = useState('')

  // Product brands multi-chip
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [brandsOther, setBrandsOther] = useState('')

  // References multi-chip
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [refsOther, setRefsOther] = useState('')

  // Constraints multi-chip
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([])
  const [constraintsOther, setConstraintsOther] = useState('')

  function toggleItem(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  function buildMultiValue(selected: string[], otherValue: string) {
    const all = selected.includes('Lainnya')
      ? [...selected.filter(x => x !== 'Lainnya'), ...(otherValue ? [otherValue] : [])]
      : selected
    return all.join(', ')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (lat === null || lng === null) { setError('Lokasi GPS wajib diambil sebelum mengirim laporan.'); setLoading(false); return }
    if (photos.length === 0) { setError('Minimal 1 foto dokumentasi wajib diunggah.'); setLoading(false); return }

    if (selectedCommodities.length === 0 && !commodityOther.trim()) { setError('Komoditas wajib dipilih.'); setLoading(false); return }
    if (selectedConstraints.length === 0 && !constraintsOther.trim()) { setError('Kendala yang dialami wajib dipilih.'); setLoading(false); return }
    if (selectedOptDetails.length === 0) { setError('Minimal 1 jenis OPT wajib dipilih.'); setLoading(false); return }
    if (selectedBrands.length === 0 && !brandsOther.trim()) { setError('Produk preferensi wajib dipilih.'); setLoading(false); return }
    if (selectedRefs.length === 0 && !refsOther.trim()) { setError('Referensi wajib dipilih.'); setLoading(false); return }

    const formData = new FormData(e.currentTarget)
    formData.set('commodity', buildMultiValue(selectedCommodities, commodityOther))
    formData.set('constraints', buildMultiValue(selectedConstraints, constraintsOther))
    formData.set('usedProducts', buildMultiValue(selectedBrands, brandsOther))
    formData.set('references', buildMultiValue(selectedRefs, refsOther))

    const computedTypes = new Set<string>()
    selectedOptDetails.forEach(detail => {
      if (OPT_DATA.Hama.includes(detail)) computedTypes.add('Hama')
      if (OPT_DATA.Penyakit.includes(detail)) computedTypes.add('Penyakit')
      if (OPT_DATA.Gulma.includes(detail)) computedTypes.add('Gulma')
    })

    formData.set('optTypes', JSON.stringify(Array.from(computedTypes)))
    formData.set('optDetails', JSON.stringify(selectedOptDetails))
    formData.set('photos', JSON.stringify(photos))
    formData.set('latitude', String(lat))
    formData.set('longitude', String(lng))

    const res = await submitCustomerBehavior(formData)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard/reports')
    }
  }

  const toggle = (list: string[], setList: (v: string[]) => void) => (val: string) => toggleItem(list, setList, val)

  // ── Offline submit handler ───────────────────────────────────
  const handleSaveOffline = async () => {
    if (lat === null || lng === null) { setError('GPS wajib diambil dulu. GPS tidak butuh internet.'); return }
    if (photoBlobs.length === 0) { setError('Minimal 1 foto dokumentasi diperlukan.'); return }
    if (!farmerName) { setError('Nama petani wajib diisi.'); return }
    setError(null)
    setLoading(true)

    const computedTypes = new Set<string>()
    selectedOptDetails.forEach(detail => {
      if (OPT_DATA.Hama.includes(detail)) computedTypes.add('Hama')
      if (OPT_DATA.Penyakit.includes(detail)) computedTypes.add('Penyakit')
      if (OPT_DATA.Gulma.includes(detail)) computedTypes.add('Gulma')
    })

    await saveDraft({
      farmerName, age, phone: hasPhone ? phone : '',
      district, districtKecamatan: districtKec, districtDesa,
      address, totalLandArea, totalLandAreaUnit,
      commodity: buildMultiValue(selectedCommodities, commodityOther),
      reasonChoice,
      constraints: buildMultiValue(selectedConstraints, constraintsOther),
      optTypes: JSON.stringify(Array.from(computedTypes)),
      optDetails: JSON.stringify(selectedOptDetails),
      usedProducts: buildMultiValue(selectedBrands, brandsOther),
      buyLocation, buyReason,
      references: buildMultiValue(selectedRefs, refsOther),
      notes,
      latitude: String(lat),
      longitude: String(lng),
    }, photoBlobs)

    setLoading(false)
    setSavedOffline(true)
  }

  if (savedOffline) {
    return (
      <div className="form-container-wide" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💾</div>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Tersimpan Offline!</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          Laporan Customer Behavior tersimpan di perangkat. Akan otomatis terkirim begitu sinyal tersedia.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/dashboard/offline-queue')} className="btn btn-outline">Lihat Antrian</button>
          <button onClick={() => router.push('/dashboard/reports')} className="btn btn-primary">Kembali ke Laporan</button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>← Kembali</button>
        <h2 style={{ margin: 0 }}>Form Laporan Customer Behavior</h2>
      </div>

      {!isOnline && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📵</span>
          <div>
            <strong style={{ color: '#92400e' }}>Mode Offline</strong>
            <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Isi form & ambil foto, lalu klik "Simpan Offline". GPS tidak butuh internet.</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Profil Petani ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Profil Petani</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="farmerName" className="form-control" required value={farmerName} onChange={e => setFarmerName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Umur <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="age" className="form-control" inputMode="numeric" pattern="[0-9]*" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }} placeholder="contoh: 40" required value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Apakah Petani Memiliki No. HP?</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="hasPhoneToggle" value="yes" checked={hasPhone} onChange={() => setHasPhone(true)} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Ya, Punya</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="hasPhoneToggle" value="no" checked={!hasPhone} onChange={() => setHasPhone(false)} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }} />
                  <span>Tidak Punya</span>
                </label>
              </div>
            </div>
            
            {hasPhone && (
              <div className="form-group">
                <label className="form-label">No. HP <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="tel" name="phone" className="form-control" required pattern="[0-9]+" title="Hanya angka" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
              <RegionSelect
                nameKabupaten="district"
                nameKecamatan="districtKecamatan"
                nameDesa="districtDesa"
                required={false}
                onChangeFullString={(str) => {
                  const parts = str.split(', ')
                  if (parts.length >= 3) {
                    setDistrictDesa(parts[0]?.replace('Desa ', ''))
                    setDistrictKec(parts[1]?.replace('Kec. ', ''))
                    setDistrict(parts[2])
                  }
                }}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Detail Alamat (Jalan / RT / RW) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea name="address" className="form-control" rows={2} placeholder="Samping masjid Al-Ikhlas..." required value={address} onChange={e => setAddress(e.target.value)} />
            </div>

            {/* Luas Lahan Total */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Luas Lahan Total <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  name="totalLandArea"
                  className="form-control"
                  step="0.01"
                  min="0"
                  placeholder="Contoh: 2.5"
                  style={{ flex: 2 }}
                  required
                  value={totalLandArea}
                  onChange={e => setTotalLandArea(e.target.value)}
                />
                <select name="totalLandAreaUnit" className="form-control" style={{ flex: 1, maxWidth: 140 }} value={totalLandAreaUnit} onChange={e => setTotalLandAreaUnit(e.target.value)}>
                  <option value="ha">Hektare (ha)</option>
                  <option value="m2">Meter Persegi (m²)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Data Pertanian ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Data Pertanian &amp; Kendala</h3>

          <div className="form-group">
            <label className="form-label">Komoditas (Pilih satu atau lebih) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <MultiChip
              options={COMMODITIES} selected={selectedCommodities}
              onToggle={toggle(selectedCommodities, setSelectedCommodities)}
              otherValue={commodityOther} onOtherChange={setCommodityOther}
              otherLabel="Nama komoditas lainnya..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', gridColumn: '1 / -1' }}>
            <label className="form-label">Alasan memilih komoditas <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" name="reasonChoice" className="form-control" required value={reasonChoice} onChange={e => setReasonChoice(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Kendala yang dialami (selain OPT) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <MultiChip
              options={CONSTRAINTS} selected={selectedConstraints}
              onToggle={toggle(selectedConstraints, setSelectedConstraints)}
              otherValue={constraintsOther} onOtherChange={setConstraintsOther}
              otherLabel="Kendala lainnya..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '1rem', display: 'block', fontSize: '1.1rem', fontWeight: 600 }}>Organisme Pengganggu Tanaman (OPT) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {Object.entries(OPT_DATA).map(([category, details]) => (
                <div key={category} style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem' }}>{category.toUpperCase()}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {details.map(detail => (
                      <label key={detail} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedOptDetails.includes(detail)} 
                          onChange={() => toggleItem(selectedOptDetails, setSelectedOptDetails, detail)} 
                          style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                        />
                        <span style={{ lineHeight: 1.3 }}>{detail}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Preferensi Produk ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Preferensi Produk</h3>

          <div className="form-group">
            <label className="form-label">Produk Preferensi Petani (Pilih satu atau lebih) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <MultiChip
              options={PRODUCT_BRANDS} selected={selectedBrands}
              onToggle={toggle(selectedBrands, setSelectedBrands)}
              otherValue={brandsOther} onOtherChange={setBrandsOther}
              otherLabel="Nama merek lainnya..."
            />
          </div>

          <div className="form-grid" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Kios tempat membeli <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="buyLocation" className="form-control" required value={buyLocation} onChange={e => setBuyLocation(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Alasan membeli produk <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="buyReason" className="form-control" required value={buyReason} onChange={e => setBuyReason(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Referensi yang biasa digunakan (Pilih satu atau lebih) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <MultiChip
                options={REFERENCES} selected={selectedRefs}
                onToggle={toggle(selectedRefs, setSelectedRefs)}
                otherValue={refsOther} onOtherChange={setRefsOther}
                otherLabel="Referensi lainnya..."
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Catatan Tambahan (Opsional)</label>
              <textarea name="notes" className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Dokumentasi ── */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Dokumentasi <span style={{ color: 'var(--danger)' }}>*</span></h3>
          <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />
          <div style={{ marginTop: '1rem' }}>
            <ImageUploader
              onUploadSuccess={setPhotos}
              onOfflineFiles={setPhotoBlobs}
              isOfflineMode={!isOnline}
              maxFiles={3}
            />
          </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
          {!isOnline ? (
            <button
              type="button"
              onClick={handleSaveOffline}
              className="btn btn-primary"
              style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
              disabled={loading || lat === null}
            >
              {loading ? 'Menyimpan...' : lat === null ? '📍 Ambil Lokasi Dulu' : '💾 Simpan Offline'}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={loading || lat === null}>
              {loading ? 'Menyimpan...' : lat === null ? '📍 Ambil Lokasi Dulu' : 'Kirim Laporan Customer Behavior'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default NewCustomerBehaviorRef
