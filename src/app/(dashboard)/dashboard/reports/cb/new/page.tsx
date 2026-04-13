'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import RegionSelect from '@/components/RegionSelect'
import GpsCapture from '@/components/GpsCapture'
import { submitCustomerBehavior } from '@/app/actions/report'

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

// ── Main Form ────────────────────────────────────────────────────
export default function NewCustomerBehaviorRef() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // OPT state (unchanged)
  const [selectedOptTypes, setSelectedOptTypes] = useState<string[]>([])
  const [selectedOptDetails, setSelectedOptDetails] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [hasPhone, setHasPhone] = useState(true)

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

  return (
    <div className="form-container-wide">
      <div className="back-header">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>← Kembali</button>
        <h2 style={{ margin: 0 }}>Form Laporan Customer Behavior</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Profil Petani ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Profil Petani</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Petani <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" name="farmerName" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Umur</label>
              <input type="text" name="age" className="form-control" inputMode="numeric" pattern="[0-9]*" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }} placeholder="contoh: 40" />
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
                <input type="tel" name="phone" className="form-control" required pattern="[0-9]+" title="Hanya angka" />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
              <RegionSelect nameKabupaten="district" nameKecamatan="districtKecamatan" nameDesa="districtDesa" required={false} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Detail Alamat (Jalan / RT / RW)</label>
              <textarea name="address" className="form-control" rows={2} placeholder="Samping masjid Al-Ikhlas..." />
            </div>

            {/* Luas Lahan Total */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Luas Lahan Total</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  name="totalLandArea"
                  className="form-control"
                  step="0.01"
                  min="0"
                  placeholder="Contoh: 2.5"
                  style={{ flex: 2 }}
                />
                <select name="totalLandAreaUnit" className="form-control" style={{ flex: 1, maxWidth: 140 }}>
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
            <label className="form-label">Komoditas (Pilih satu atau lebih)</label>
            <MultiChip
              options={COMMODITIES} selected={selectedCommodities}
              onToggle={toggle(selectedCommodities, setSelectedCommodities)}
              otherValue={commodityOther} onOtherChange={setCommodityOther}
              otherLabel="Nama komoditas lainnya..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', gridColumn: '1 / -1' }}>
            <label className="form-label">Alasan memilih komoditas</label>
            <input type="text" name="reasonChoice" className="form-control" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Kendala yang dialami (selain OPT)</label>
            <MultiChip
              options={CONSTRAINTS} selected={selectedConstraints}
              onToggle={toggle(selectedConstraints, setSelectedConstraints)}
              otherValue={constraintsOther} onOtherChange={setConstraintsOther}
              otherLabel="Kendala lainnya..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '1rem', display: 'block', fontSize: '1.1rem', fontWeight: 600 }}>Organisme Pengganggu Tanaman (OPT)</label>
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
            <label className="form-label">Produk Preferensi Petani (Pilih satu atau lebih)</label>
            <MultiChip
              options={PRODUCT_BRANDS} selected={selectedBrands}
              onToggle={toggle(selectedBrands, setSelectedBrands)}
              otherValue={brandsOther} onOtherChange={setBrandsOther}
              otherLabel="Nama merek lainnya..."
            />
          </div>

          <div className="form-grid" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Kios tempat membeli</label>
              <input type="text" name="buyLocation" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Alasan membeli produk</label>
              <input type="text" name="buyReason" className="form-control" />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Referensi yang biasa digunakan (Pilih satu atau lebih)</label>
              <MultiChip
                options={REFERENCES} selected={selectedRefs}
                onToggle={toggle(selectedRefs, setSelectedRefs)}
                otherValue={refsOther} onOtherChange={setRefsOther}
                otherLabel="Referensi lainnya..."
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Catatan Tambahan (Opsional)</label>
              <textarea name="notes" className="form-control" rows={3} />
            </div>
          </div>
        </div>

        {/* ── Dokumentasi ── */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Dokumentasi</h3>
          <GpsCapture onCapture={(la, lo) => { setLat(la); setLng(lo) }} onClear={() => { setLat(null); setLng(null) }} />
          <div style={{ marginTop: '1rem' }}>
            <ImageUploader onUploadSuccess={setPhotos} maxFiles={3} />
          </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={loading}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={loading || lat === null}>
            {loading ? 'Menyimpan...' : lat === null ? '📍 Ambil Lokasi Dulu' : 'Kirim Laporan Customer Behavior'}
          </button>
        </div>
      </form>
    </div>
  )
}
