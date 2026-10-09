# Developer Brief: Fitur Analitik Peta Demplot & Analisa Dampak Penjualan di Agrolens

## 1. Ringkasan & Tujuan Fitur
Membangun fitur **Peta Demplot & Analisa Dampak Penjualan (Demoplot Sales Impact Analytics)** di Agrolens. Fitur ini berfungsi untuk menganalisis dan memvisualisasikan korelasi antara kegiatan demoplot agronomis dengan perubahan penjualan produk terkait pada toko-toko binaan di sekitar lokasi kegiatan (radius ≤ 5 km).

> **PENTING (Batasan Scope):**
> 1. Fitur ini **HANYA untuk analitik dampak penjualan demoplot** (Peta + Perbandingan Omset Sebelum vs Sesudah + Toko Terdampak). Fitur *Operasional & Leads / Diseminasi Salesman* **TIDAK PERLU** dibuat.
> 2. Data transaksi penjualan dan master toko **TIDAK diambil langsung dari Accurate Online**, melainkan ditarik dari **Open API Sales Dashboard** via cron job harian.

---

## 2. Integrasi Data dari Sales Dashboard Open API

### 2.1. Konfigurasi Environment (`.env`)
Tambahkan variabel environment berikut di Agrolens:
```env
SALES_DASHBOARD_URL="https://sales.gamaagrosejati.co.id"
SALES_DASHBOARD_API_KEY="<SALES_DASHBOARD_API_KEY>"
```
*Autentikasi HTTP Header:* `Authorization: Bearer ${SALES_DASHBOARD_API_KEY}`

### 2.2. Spesifikasi Endpoint yang Digunakan
1. **Master Toko / Pelanggan Berkoordinat GPS**
   - **Endpoint:** `GET /api/v1/customers?with_coords=1&limit=10000`
   - **Fungsi:** Mengambil master toko yang memiliki titik koordinat GPS (`latitude`, `longitude`), nomor pelanggan (`customer_no`), nama toko (`name`), kota (`city`), dan nama salesman (`default_salesman`).

2. **Invoice Penjualan Beserta Rincian Produk**
   - **Endpoint:** `GET /api/v1/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD&include_items=1&limit=10000`
   - **Query Params Penting:** `include_items=1` (wajib, agar item detail faktur disertakan).
   - **Struktur Item:**
     ```json
     {
       "id_invoice": "645.26.09.13307",
       "tanggal": "2026-09-24",
       "customer_id": "61701",
       "nama_toko": "Konco Tani Karanganyar",
       "nama_sales": "Telemarketing 3",
       "status": "Terkirim", // Catatan: jika status === "Retur", nilai omset/qty diperlakukan minus
       "omset": 59459,
       "items": [
         {
           "item_no": "PTR-HB-103",
           "item_name": "See Top 525 SL 1 L (new)",
           "quantity": 1,
           "unit": "Btl",
           "unit_price": 66000,
           "total_price": 66000
         }
       ]
     }
     ```

---

## 3. Skema Basis Data & Cron Job Sinkronisasi di Agrolens

### 3.1. Tabel Sinkronisasi di Database Agrolens
Buat tabel lokal untuk menyimpan cache data dari Sales Dashboard (agar kalkulasi analitik cepat dan tidak membebani network):

1. **`dashboard_customers`**:
   - `id` (UUID / TEXT PRIMARY KEY)
   - `accurate_id` (TEXT, unique/index)
   - `customer_no` (TEXT)
   - `name` (TEXT)
   - `city` (TEXT)
   - `default_salesman` (TEXT)
   - `latitude` (NUMERIC)
   - `longitude` (NUMERIC)
   - `updated_at` (TIMESTAMPTZ)

2. **`dashboard_invoices`**:
   - `id_invoice` (TEXT PRIMARY KEY)
   - `customer_id` (TEXT, index)
   - `tanggal` (DATE, index)
   - `status` (TEXT)
   - `omset` (NUMERIC)
   - `items` (JSONB) — array item transaksi
   - `updated_at` (TIMESTAMPTZ)

### 3.2. Cron Job Sinkronisasi Harian (`sync-sales-dashboard`)
Buat endpoint cron (misal: `GET /api/cron/sync-sales-dashboard`) yang dijadwalkan berjalan setiap hari (rekomendasi: pukul **04:30 WIB**):
1. **Sync Customers:** Tarik `GET /api/v1/customers?with_coords=1` dan upsert ke `dashboard_customers`.
2. **Sync Invoices:** Tarik `GET /api/v1/invoices` dengan rentang tanggal `from = TODAY - 90 hari` s/d `to = TODAY` dengan `include_items=1`, lalu upsert ke `dashboard_invoices`.

---

## 4. Logika Bisnis & Algoritma Analisa Dampak (`demoplot-impact`)

Ketika sebuah titik kegiatan demoplot (`activity_id`) dipilih, jalankan kalkulasi dengan alur berikut:

### 4.1. Spatial Matching Toko (Radius ≤ 5 km)
Gunakan rumus **Haversine** untuk mencari seluruh toko dari `dashboard_customers` yang berada dalam jarak `≤ 5 km` dari titik demoplot (`activity.latitude`, `activity.longitude`).

```typescript
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 4.2. Time Window Perbandingan
Gunakan jendela perbandingan **60 Hari Sebelum** vs **60 Hari Sesudah** tanggal demoplot:
- **Periode Sebelum (*Before*):** `[activity.tanggal - 60 hari]` s/d `[activity.tanggal - 1 hari]`
- **Periode Sesudah (*After*):** `[activity.tanggal]` s/d `[activity.tanggal + 60 hari]`

### 4.3. Pencocokan Produk Demplot dengan Item Invoice (`productsMatch`)
Nama produk pada data demoplot agronomis (misal: `"Ziflo 76 WG 800 gr"`) seringkali sedikit berbeda dengan penamaan di faktur/SKU Accurate (misal: `"Ziflo 76 WG 200 gr (New)"`).
Gunakan fungsi pencocokan fleksibel berbasis token (*token-based fuzzy match*):

```typescript
const UNIT_STOP = new Set([
  'ml', 'l', 'ltr', 'kg', 'gr', 'g', 'gram', 'cc', 'box', 'btl', 'botol', 'pack', 'sachet',
  'ec', 'sl', 'wp', 'sc', 'wg', 'wdg', 'ws', 'as', 'fs', 'sp', 'od', 'se', 'dc', 'cs', 'ew'
]);

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sigTokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length >= 3 && !UNIT_STOP.has(t) && !/^\d+$/.test(t));
}

export function productsMatch(demoplotProd: string, invoiceItemName: string): boolean {
  const na = norm(demoplotProd);
  const nb = norm(invoiceItemName);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;

  const ta = new Set(sigTokens(demoplotProd));
  const tb = new Set(sigTokens(invoiceItemName));
  if (ta.size === 0 || tb.size === 0) return false;

  let overlap = 0;
  let brandHit = false;
  ta.forEach(t => {
    if (tb.has(t)) {
      overlap++;
      if (t.length >= 5) brandHit = true; // Kata brand utama (misal: 'ziflo', 'ambition', 'sidamethrin')
    }
  });
  return overlap >= 2 || brandHit;
}
```

### 4.4. Perhitungan Output Analitik
1. **Per-Produk Demplot:**
   - `before_qty`, `after_qty`, `delta_qty`
   - `before_omset`, `after_omset`, `delta_omset`
   - `delta_pct` (persentase kenaikan)
   - `is_new`: `true` jika `before_qty === 0 && after_qty > 0` (Pembelian baru muncul setelah demoplot).
2. **Per-Toko di Radius 5 km:**
   - Evaluasi setiap toko di radius 5 km: apakah toko tersebut membeli salah satu produk demoplot pada periode *After*?
   - Jika membeli: beri tanda `has_impact = true`, hitung `impact_total_qty`, `impact_total_omset`, dan daftar produk yang dibeli (`impact_products`).
   - Urutkan toko terdampak (`has_impact === true`) di urutan paling atas.

---

## 5. Spesifikasi UI Frontend (Peta Demplot & Panel Analisis)

Gunakan Leaflet (atau library peta yang dipakai Agrolens saat ini):

### 5.1. Tampilan Peta
1. **Titik Demoplot:**
   - Titik biasa: Marker ungu / biru.
   - Titik demoplot yang **terbukti berdampak penjualan**: Marker hijau dengan penanda khusus.
2. **Saat Titik Demoplot Diklik:**
   - Gambar lingkaran putus-putus transparan radius 5 km (`L.circle` dengan radius 5000 meter).
   - Render marker toko pelanggan di dalam radius:
     - **Toko biasa dalam radius:** Marker lingkaran biru kecil (`#2563eb`).
     - **Toko terdampak penjualan produk demplot:** Marker hijau zamrud (`#059669`, radius lebih besar, z-index di atas).
     - **Tooltip Toko Terdampak:** Menampilkan label `⭐ Terdampak Penjualan Demplot` beserta nama produk dan kuantiti yang dibeli.
3. **Legenda Peta:**
   - Tambahkan keterangan warna marker (Demplot, Demplot Berdampak Penjualan, Toko dalam Radius, Toko Berdampak Penjualan).

### 5.2. Panel Samping Detail Demplot
Ketika user mengklik titik demoplot, buka panel rincian di sisi kanan:
1. **Header Kegiatan:** Judul/Nama Petani, Tanggal Kegiatan, Komoditas, Lokasi (Desa, Kec, Kab), dan Nama Agronomis.
2. **Kartu Analisis Per-Produk Demplot:**
   - Nama produk demplot.
   - Angka penjualan: `Sebelum: X pcs (Rp ...) → Sesudah: Y pcs (Rp ...)`.
   - Badge hijau `✨ Pembelian baru muncul setelah demoplot` (jika sebelumnya 0).
3. **Daftar Toko Radius 5 km:**
   - Badge jumlah: `🏪 Toko Radius 5 km (N) | ⭐ X Terdampak Penjualan`.
   - Toko yang terdampak diberi border hijau tebal (`border-left: 3.5px solid #16a34a`), background hijau muda, dan tag `⭐ Terdampak`.
   - Menampilkan rincian: `🛒 Penjualan Produk Demplot: +X PCS (Rp ...)`.
   - Jika toko diklik: Tampilkan riwayat transaksi pembelian toko tersebut dalam 12 bulan terakhir.

---

## 6. Langkah Kerja (Action Plan untuk AI Agent)
1. Buat migration database di Agrolens untuk tabel `dashboard_customers` dan `dashboard_invoices`.
2. Buat service / client untuk memanggil API Sales Dashboard (`/api/v1/customers` dan `/api/v1/invoices`).
3. Buat route cron job `api/cron/sync-sales-dashboard` untuk sinkronisasi data terjadwal.
4. Buat module utilitas `productsMatch` dan kalkulasi spasial `haversineKm`.
5. Buat API endpoint `/api/demoplot-impact?id={activityId}&radiusKm=5&windowDays=60`.
6. Implementasikan komponen UI Peta Demplot + Panel Analisa Dampak sesuai spesifikasi di atas.
