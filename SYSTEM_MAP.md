# SYSTEM_MAP — Gamagronomist (Agrolens)

---

## Project Summary

**Tujuan:** Sistem manajemen aktivitas lapangan agronomi untuk perusahaan agrokimia. Mengelola distribusi stok produk (pestisida/pupuk) dari gudang pusat ke AFA → FO, pencatatan kegiatan lapangan (demplot, kunjungan kios, CB, spot demplot), serta integrasi stok dengan Accurate Online ERP. Dilengkapi modul SOP (Standard Operating Procedure) untuk manajemen dokumen prosedur seluruh tim.

**Tech Stack Utama:**
| Layer | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Next.js 15 (App Router, Server Actions) |
| Database | PostgreSQL via Supabase (pooler port 6543 untuk Prisma, port 5432 untuk `db push`/migrasi) |
| ORM | Prisma 6 |
| Auth | JWT (jose) + bcryptjs, session di HttpOnly cookie (7 hari) |
| Notifikasi WA | WAHA (WhatsApp HTTP API) self-hosted |
| Upload Foto | Cloudinary (unsigned preset) |
| Upload PDF | Cloudinary (via `/api/sop/upload` — `raw` resource type) |
| PDF Viewer | `react-pdf` (mozilla/pdf.js) — render PDF di browser/mobile tanpa plugin |
| ERP Integrasi | Accurate Online API (HMAC-SHA256 auth) |
| Deploy | Vercel (dengan Cron job harian) |
| Mobile | Android TWA (Trusted Web Activity) — file `.aab` & `.apk` di root |

**Pola Arsitektur:** Monolith Next.js — Server Actions untuk mutasi data, Route Handlers (`/api/*`) untuk query data client-side. Ledger double-entry sebagai inti pencatatan stok. Tidak ada state management eksternal (Zustand/Redux). Middleware JWT di edge runtime.

> **Catatan Supabase:** `.env` menggunakan `DATABASE_URL` dengan host `aws-1-ap-southeast-1.pooler.supabase.com:6543` (PgBouncer). Untuk `prisma db push` / migrasi skema wajib menggunakan port `5432` (session mode) karena PgBouncer tidak support DDL statements.

---

## Core Logic Flow (Function-Level)

### 1. Autentikasi
```
/login page → login()[actions/auth.ts] → prisma.user.findUnique → bcrypt.compare
  → encrypt(JWT payload) → set cookie 'session'
  → middleware.ts: decrypt(cookie) → block if !userId || !isActive → redirect /login
```

### 2. AFA Request Stok (Gudang Utama — 4 tahap approval)
```
/dashboard/stock → submitAfaStockRequest()[afa-stock.ts]
  → prisma.request.create (status: SUBMITTED, warehouseSource: MAIN)
  → notify SPV in-app + WA (waha.ts → SystemConfig[wa_spv])

SPV approve → approveSpvStockRequest()[afa-stock.ts]
  → prisma.request.update (status: APPROVED_SPV)
  → notify FAM (WA + in-app)

FAM approve → approveFamStockRequest()[afa-stock.ts]
  → prisma.request.update (status: APPROVED_FAM)
  → notify WHM (WA + in-app)

WHM approve → approveWhmStockRequest()[afa-stock.ts]
  → createSalesInvoice()[lib/accurate.ts] → POST Accurate /sales-invoice/save.do
    (harga dari fetchItemPrices, kategori "CJ R2")
  → prisma.request.update (status: APPROVED_WHM, accurateInvoiceNo)
  → notify AFA (WA + in-app)

SPV terima stok → receiveSpvStockRequest()[afa-stock.ts]
  → prisma.ledger.createMany (transactionType: STOCK_IN_GUDANG, qty = raw gramasi)
  → prisma.request.update (status: APPROVED)
  → notify AFA (WA + in-app)
```

### 3. AFA Request Stok (Gudang Sampel — langsung approve)
```
/dashboard/stock → submitAfaStockRequest()[afa-stock.ts] (warehouseSource: SAMPLE)
  → prisma.request.create (status: SUBMITTED)
  → SPV approve: deduct SampleLedger (SAMPLE_OUT) + Ledger AFA (STOCK_IN_GUDANG)
```

### 4. FO Request Produk ke AFA (Transfer)
```
/dashboard/demoplot/request → request.ts → prisma.request.create (status: SUBMITTED)
  → AFA approve: approveRequest()[actions/approve.ts]
    → transferAfaToFo()[lib/ledger/stock.ts]
      → prisma.$transaction([
          Ledger(AFA, TRANSFER_TO_FO, -qty),
          Ledger(FO, RECEIVE_FROM_AFA, +qty)
        ])
```

### 5. Eksekusi Demplot (pakai stok)
```
/dashboard/demoplot/new → submitStandaloneDemoPlot()[standalone-demoplot.ts]
  → resolveAreaIdFromCoords()[lib/area-resolver.ts] → geocode.ts → nominatim API
  → prisma.request.create (status: APPROVED, auto) + prisma.demoPlot.create
  → prisma.ledger.create (transactionType: USAGE_DEMOPLOT, qty: -actualUsage)
    [hanya untuk produk milik user, bukan produk petani]
  → notify SPV/AFA in-app
```

### 6. Spot Demplot (pakai stok)
```
/dashboard/reports → submitSpotDemplot()[actions/spot-demplot.ts]
  → prisma.spotDemplot.create + prisma.spotDemplotDetail.createMany
  → prisma.ledger.create (USAGE_SPOT_DEMOPLOT, qty: -actualUsage) per produk user
```

### 7. Saldo Stok (Display)
```
/dashboard/stock → getStockBalance()[lib/ledger/stock.ts]
  → prisma.ledger.groupBy(productId)._sum.quantity WHERE userId
  → UI: primaryQty = raw gramasi (ml/gr), secondaryQty = primaryQty / gramasiPerUnit (kemasan)
```

### 8. Sync Accurate (Cron Harian)
```
vercel.json cron ("0 0 * * *") → GET /api/accurate-sync-cron
  → runAccurateSync()[lib/accurate-sync.ts]
    → fetchAccurateItems()[lib/accurate.ts] → GET Accurate /item/list.do (paginated)
    → upsert Product (name, accurateId, spvStock)
```

### 9. SOP — Upload & View PDF
```
/dashboard/sop (SopClient.tsx)
  → Upload: POST /api/sop/upload
    → Cloudinary upload (resource_type: raw, folder: sop/)
    → return { fileUrl, fileName }
  → Save SOP: POST /api/sop (create) atau PUT /api/sop/[id] (edit)
    → prisma.sop.create / prisma.sop.update
    → body: { title, category, fileUrl, fileName }
  → View PDF: react-pdf <Document file="/api/sop/proxy?url=...">
    → GET /api/sop/proxy?url=[Cloudinary URL]
    → Server fetch Cloudinary → stream ke browser (bypass CORS)
    → render halaman-per-halaman via mozilla pdf.js engine
```

### 10. SOP — Manajemen Kategori
```
/dashboard/sop → klik "⚙️ Kelola Kategori"
  → GET /api/sop-categories → prisma.sopCategory.findMany
  → Tampil modal: daftar kategori + form tambah

Tambah: POST /api/sop-categories → prisma.sopCategory.create { name }
Edit:   PUT  /api/sop-categories/[id]
    → prisma.sopCategory.update (name)
    → prisma.sop.updateMany (category: newName) ← sync nama di semua SOP terkait
Delete: DELETE /api/sop-categories/[id] → prisma.sopCategory.delete
    (SOP tidak terhapus, nama kategori di SOP tidak berubah otomatis)

Field "Kategori" di form upload/edit SOP = <select> yang membaca data dari sopCategory
Filter kategori di halaman SOP = <select> + chip button juga bersumber dari sopCategory
```

---

## Clean Tree

```
Gamagronomist/
├── prisma/
│   ├── schema.prisma          ← Definisi semua model DB (termasuk Sop, SopCategory)
│   └── seed.ts                ← Seed data awal
├── public/                    ← Aset statis (ikon PWA, manifest)
├── src/
│   ├── middleware.ts           ← Auth guard JWT (Edge Runtime)
│   ├── app/
│   │   ├── layout.tsx          ← Root layout + font
│   │   ├── page.tsx            ← Landing / redirect
│   │   ├── globals.css         ← CSS global + design tokens
│   │   ├── (auth)/             ← Layout tanpa sidebar
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      ← Layout dengan sidebar + notif bell
│   │   │   └── dashboard/
│   │   │       ├── page.tsx            ← Home dashboard (KPI + ringkasan)
│   │   │       ├── demoplot/           ← List + detail + new + execute + approve
│   │   │       ├── stock/
│   │   │       │   ├── page.tsx        ← Saldo stok + pengajuan + pantauan tim
│   │   │       │   ├── history/        ← Riwayat ledger
│   │   │       │   ├── in/             ← Form input stok masuk (AFA)
│   │   │       │   └── sample/         ← Gudang sampel SPV
│   │   │       ├── reports/            ← Semua jenis laporan (CB, demplot, kios, dst)
│   │   │       ├── master/             ← Users, produk, toko, area, import
│   │   │       ├── opname/             ← Opname stok
│   │   │       ├── settings/           ← Profil, WA config, sistem
│   │   │       ├── so/                 ← Sales Order (Accurate SO)
│   │   │       └── sop/                ← [BARU] Modul SOP dokumen
│   │   │           ├── page.tsx        ← Server component (baca session → render SopClient)
│   │   │           └── SopClient.tsx   ← Client component lengkap:
│   │   │                               │   - list SOP grouped by category
│   │   │                               │   - PDF viewer (react-pdf via proxy)
│   │   │                               │   - form create/edit SOP
│   │   │                               │   - modal kelola kategori (add/edit/delete)
│   │   │                               └─  - filter & search SOP
│   │   ├── actions/            ← Server Actions (mutasi data)
│   │   │   ├── auth.ts
│   │   │   ├── afa-stock.ts
│   │   │   ├── approve.ts
│   │   │   ├── standalone-demoplot.ts
│   │   │   ├── spot-demplot.ts
│   │   │   ├── sample-stock.ts
│   │   │   ├── report.ts
│   │   │   ├── master.ts
│   │   │   ├── kpi.ts
│   │   │   ├── opname.ts
│   │   │   ├── opname-spv.ts
│   │   │   ├── stock-admin.ts
│   │   │   ├── bulk-import.ts
│   │   │   ├── register.ts
│   │   │   ├── request.ts
│   │   │   ├── migration.ts
│   │   │   └── region.ts
│   │   └── api/                ← Route Handlers (data client-side)
│   │       ├── auth/
│   │       ├── products/
│   │       ├── stock/
│   │       ├── spv-stock/
│   │       ├── sample-stock/
│   │       ├── sample-stock-for-afa/
│   │       ├── ledger/
│   │       ├── afa-stock/
│   │       ├── users/
│   │       ├── master/
│   │       ├── accurate-sync/
│   │       ├── accurate-sync-cron/
│   │       ├── accurate-so/
│   │       ├── accurate-branches/
│   │       ├── accurate-item-detail/
│   │       ├── accurate-sync-customers/
│   │       ├── demoplot-map/
│   │       ├── demoplot-request/
│   │       ├── demoplot-stats/
│   │       ├── reports/
│   │       ├── cb-farmers/
│   │       ├── cb-stats/
│   │       ├── leaderboard/
│   │       ├── target-data/
│   │       ├── notifications/
│   │       ├── upload/
│   │       ├── system-config/
│   │       ├── migration/
│   │       ├── admin/
│   │       ├── sop/                    ← [BARU] SOP CRUD
│   │       │   ├── route.ts            GET (list) + POST (create)
│   │       │   ├── [id]/route.ts       PUT (edit title/category/file) + DELETE
│   │       │   ├── upload/route.ts     POST upload PDF ke Cloudinary (raw)
│   │       │   └── proxy/route.ts      GET stream PDF dari Cloudinary (bypass CORS)
│   │       └── sop-categories/         ← [BARU] Manajemen Kategori SOP
│   │           ├── route.ts            GET (list) + POST (create)
│   │           └── [id]/route.ts       PUT (rename + sync SOP) + DELETE
│   ├── components/
│   │   ├── AfaStockRequestTable.tsx
│   │   ├── TeamStockTable.tsx
│   │   ├── StockAdjustmentModal.tsx
│   │   ├── KpiDashboard.tsx
│   │   ├── KpiFieldDashboard.tsx
│   │   ├── TargetDashboard.tsx
│   │   ├── DemoPlotMap.tsx
│   │   ├── DemoPlotReportTable.tsx
│   │   ├── ImportModal.tsx
│   │   ├── MigrationImportModal.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── GpsCapture.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── RegionSelect.tsx
│   │   ├── AreaLeaderboard.tsx
│   │   └── [lainnya...]
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── accurate.ts
│   │   ├── accurate-sync.ts
│   │   ├── waha.ts
│   │   ├── area-resolver.ts
│   │   ├── geocode.ts
│   │   ├── kpi-filters.ts
│   │   ├── offline-db.ts
│   │   └── ledger/
│   │       └── stock.ts
│   └── hooks/
├── .env                        ← Variabel environment aktif (tidak di-commit)
├── .env.example                ← Template variabel environment
├── vercel.json                 ← Konfigurasi Cron (accurate-sync-cron, daily 00:00 UTC)
├── next.config.ts              ← Konfigurasi Next.js
├── prisma/schema.prisma        ← Skema database
├── twa-manifest.json           ← Konfigurasi Android TWA
└── migrate-categories.js       ← [BARU] Script one-shot seed tabel SopCategory dari data Sop existing
```

---

## Module Map (The Chapters)

| File | Fungsi/Class Utama | Peran |
|---|---|---|
| `middleware.ts` | `middleware()` | Guard seluruh halaman non-API; redirect ke /login jika session invalid/inactive |
| `lib/auth.ts` | `encrypt()`, `decrypt()` | Sign & verify JWT HS256 dengan jose |
| `lib/accurate.ts` | `fetchAccurateItems()`, `createSalesInvoice()`, `fetchItemPrices()`, `fetchAccurateCustomers()` | Client resmi Accurate Online API dengan HMAC-SHA256 auth |
| `lib/accurate-sync.ts` | `runAccurateSync()` | Upsert Product lokal dari data Accurate (nama, SKU, spvStock) |
| `lib/waha.ts` | `sendWhatsApp()`, `sendWhatsAppBulk()`, `getMsgTemplate()`, `getRolePhones()` | Kirim notifikasi WhatsApp via WAHA API; template pesan disimpan di SystemConfig |
| `lib/area-resolver.ts` | `resolveAreaIdFromCoords()` | Resolve areaId dari GPS menggunakan AreaCoverage + Nominatim |
| `lib/geocode.ts` | `getKabupatenFromCoords()` | Reverse geocode koordinat ke nama kabupaten via Nominatim OSM |
| `lib/ledger/stock.ts` | `getStockBalance()`, `insertStockInGudang()`, `transferAfaToFo()` | Core engine ledger: hitung saldo & mutasi stok dalam atomic transaction |
| `actions/auth.ts` | `login()`, `logout()`, `changePassword()`, `resetPasswordWithEmail()`, `updateProfilePhoto()` | Autentikasi & manajemen akun user |
| `actions/afa-stock.ts` | `submitAfaStockRequest()`, `approveSpv/Fam/WhmStockRequest()`, `receiveSpvStockRequest()`, `rejectAfaStockRequest()` | Seluruh workflow pengajuan restock AFA (4-step approval + integrasi Accurate invoice) |
| `actions/approve.ts` | `approveRequest()`, `rejectRequest()` | AFA approve/reject transfer stok ke FO |
| `actions/standalone-demoplot.ts` | `submitStandaloneDemoPlot()`, `submitContinueDemoPlot()` | Buat & lanjutkan sesi demplot; otomatis deduct ledger stok |
| `actions/spot-demplot.ts` | `submitSpotDemplot()`, `deleteSpotDemplot()` | Buat laporan spot demplot + deduct stok |
| `actions/sample-stock.ts` | `addSampleStock()`, `adjustSampleStock()`, `removeSampleProduct()`, `getSampleBalance()` | Manajemen Gudang Sampel SPV (SampleLedger) |
| `actions/report.ts` | `submitCb()`, `submitVisitKios()`, `submitGathering()`, `submitVisitCompany()`, `submitContentVideo()` | Submit semua jenis laporan aktivitas lapangan |
| `actions/master.ts` | `createUser()`, `updateUser()`, `deleteUser()`, `createProduct()`, `createStore()`, `setKpiTarget()` | CRUD master data |
| `actions/opname.ts` | `submitOpname()` | FO/AFA ajukan stock opname |
| `actions/opname-spv.ts` | `approveOpname()`, `rejectOpname()` | SPV approve/reject opname |
| `actions/stock-admin.ts` | `adjustStockAdmin()` | ADMIN override stok langsung |
| `actions/bulk-import.ts` | `importUsersExcel()`, `importStoresExcel()` | Import data massal dari Excel |
| `actions/kpi.ts` | `getKpiData()`, `setKpiTargets()` | Hitung & set target KPI per area/bulan |
| `api/accurate-sync-cron/route.ts` | `GET()` | Endpoint Vercel Cron (harian 00:00 UTC) untuk sync produk dari Accurate |
| `api/upload/route.ts` | `POST()` | Upload **foto** ke Cloudinary (image), resize + compress via URL transformation |
| `api/sop/upload/route.ts` | `POST()` | **[BARU]** Upload **PDF** ke Cloudinary (`resource_type: raw`, folder `sop/`) — return `{ fileUrl, fileName }` |
| `api/sop/proxy/route.ts` | `GET(?url=)` | **[BARU]** Proxy PDF dari Cloudinary ke browser — mengatasi CORS & Content-Disposition block agar react-pdf bisa render |
| `api/sop/route.ts` | `GET()`, `POST()` | **[BARU]** List semua SOP (dengan include author); buat SOP baru |
| `api/sop/[id]/route.ts` | `PUT()`, `DELETE()` | **[BARU]** Edit (judul/kategori/file) atau hapus SOP; hanya role AFA/SPV/ADMIN/PLANTATION |
| `api/sop-categories/route.ts` | `GET()`, `POST()` | **[BARU]** Daftar kategori dari tabel `SopCategory`; tambah kategori baru |
| `api/sop-categories/[id]/route.ts` | `PUT()`, `DELETE()` | **[BARU]** Rename kategori (+ sync ke semua SOP terkait) atau hapus kategori |
| `dashboard/sop/SopClient.tsx` | `SopClient` | **[BARU]** Full client component SOP: list+filter+search, PDF viewer (react-pdf), form upload/edit, modal kelola kategori |
| `api/stock/balance/route.ts` | `GET()` | Hitung saldo stok user dari Ledger (groupBy productId) |
| `api/sample-stock/route.ts` | `GET()` | Hitung saldo + riwayat SampleLedger untuk SPV |
| `components/TeamStockTable.tsx` | `TeamStockTable` | Tabel pantauan stok seluruh tim dengan expand per produk + klik untuk adjustment |
| `components/StockAdjustmentModal.tsx` | `StockAdjustmentModal` | Modal input penyesuaian stok per user dengan pre-fill produk |
| `components/DemoPlotMap.tsx` | `DemoPlotMap` | Peta interaktif Leaflet untuk visualisasi titik GPS demplot |
| `components/KpiDashboard.tsx` | `KpiDashboard` | Komponen dashboard KPI dengan filter area/bulan/tahun |
| `components/AfaStockRequestTable.tsx` | `AfaStockRequestTable` | Tabel daftar pengajuan stok dengan tombol approval per role |
| `components/NotificationBell.tsx` | `NotificationBell` | Bell dengan polling notifikasi + mark as read |

---

## Data & Config

### Lokasi Config
| File | Isi |
|---|---|
| `.env` | `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `ACCURATE_API_TOKEN`, `ACCURATE_SIGNATURE_SECRET`, `ACCURATE_HOST`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, `CRON_SECRET` |
| `prisma/schema.prisma` | Definisi semua model Prisma |
| `vercel.json` | Cron job: `GET /api/accurate-sync-cron` setiap `0 0 * * *` (daily) |
| `SystemConfig` (DB table) | Konfigurasi runtime: `waha_base_url`, `waha_api_key`, `waha_session`, `wa_spv`, `wa_fam`, `wa_whm`, template pesan WA |

### Skema Data Inti

```
User ──┐ (afaId self-ref AFA→FO)
       ├── areaId → Area ──── AreaCoverage (kabupatenName)
       ├── Ledger[] ──────── productId → Product
       ├── SampleLedger[] ── productId → Product
       ├── requestsAsFo (Request[])
       ├── requestsAsAfa (Request[])
       ├── Notification[]
       ├── Sop[]             ← [BARU] SOP yang diupload oleh user ini
       └── [laporan: CB, VisitKios, Gathering, Company, Video, SpotDemplot]

Request ──── RequestDetail[] → Product
         └── DemoPlot[] ──── DemoPlotDetail[] → Product
                         └── farmerId → Farmer

Ledger: userId + productId + transactionType + quantity (±) + referenceId + snapshotAreaId
SampleLedger: userId + productId + transactionType + quantity (±)

StockOpname ── OpnameDetail[] → Product

KpiTarget ── areaId → Area (nullable = global)

Sop: id + title + fileUrl + fileName + category (String) + isPublished + authorId → User   ← [BARU]
SopCategory: id + name (unique) + createdAt + updatedAt                                      ← [BARU]
```

> **Catatan SopCategory vs Sop.category:** Kolom `Sop.category` menyimpan nama kategori sebagai `String` (bukan FK). Tabel `SopCategory` adalah master daftar kategori. Saat rename kategori via `PUT /api/sop-categories/[id]`, sistem juga menjalankan `prisma.sop.updateMany` untuk sinkronisasi nama di semua SOP terkait.

**transactionType Ledger:**
| Type | Arah | Trigger |
|---|---|---|
| `STOCK_IN_GUDANG` | + | SPV terima stok dari Accurate |
| `TRANSFER_TO_FO` | − | AFA kirim ke FO |
| `RECEIVE_FROM_AFA` | + | FO terima dari AFA |
| `USAGE_DEMOPLOT` | − | Eksekusi demplot |
| `USAGE_SPOT_DEMOPLOT` | − | Spot demplot |
| `ADJUSTMENT_PLUS/MINUS` | ± | Admin/SPV override |
| `DIRECT_USAGE_AFA` | − | AFA pakai langsung |

**Aturan satuan:** Semua nilai `quantity` di `Ledger` disimpan dalam satuan terkecil (ml/gr = `unitGramasi`). UI menampilkan gramasi sebagai primer dan membagi dengan `gramasiPerUnit` untuk mendapatkan nilai kemasan (Btl/Bks/PCS).

### Lokasi Migration & Seed
| File | Tujuan |
|---|---|
| `prisma/seed.ts` | Seed data awal (roles, produk dasar, dll) |
| `migrate-ledger.js` | Script one-shot normalisasi data ledger lama |
| `revert-ledger.js` | Script rollback normalisasi |
| `fix-ledger.js` | Script koreksi ledger dengan referensi corrupted.txt |
| `migrate-categories.js` | **[BARU]** Seed tabel `SopCategory` dari data `Sop.category` existing + kategori default |

### Folder Output/Artifacts
| Path | Isi |
|---|---|
| `.next/` | Build output Next.js (excluded dari analisis) |
| `app-release-signed.apk` | APK Android TWA rilis |
| `app-release-bundle.aab` | AAB untuk Google Play |

---

## External Integrations

| Service | Tujuan | Modul Pemanggil |
|---|---|---|
| **Accurate Online API** | Sync master produk, buat Sales Invoice, lookup harga, daftar customer | `lib/accurate.ts`, `lib/accurate-sync.ts`, `api/accurate-sync*`, `api/accurate-so/` |
| **WAHA (WhatsApp HTTP API)** | Kirim notifikasi WA ke SPV/FAM/WHM/AFA di setiap step approval | `lib/waha.ts` → dipanggil dari `actions/afa-stock.ts` |
| **Cloudinary** | Upload & resize **foto** lapangan (demplot, CB, profil) | `api/upload/route.ts` |
| **Cloudinary (raw/PDF)** | **[BARU]** Upload dokumen PDF SOP (`resource_type: raw`) | `api/sop/upload/route.ts` |
| **Nominatim (OpenStreetMap)** | Reverse geocode GPS → nama kabupaten untuk resolusi area | `lib/geocode.ts` → `lib/area-resolver.ts` |
| **Supabase PostgreSQL** | Database production (sebelumnya: Neon) | `DATABASE_URL` di `.env`, seluruh Prisma client |
| **Vercel Cron** | Trigger sync Accurate harian (00:00 UTC) | `vercel.json` → `api/accurate-sync-cron/` |

---

## Role & Akses Modul SOP

| Role | Lihat SOP | Upload/Edit/Hapus SOP | Kelola Kategori |
|---|---|---|---|
| AFA | ✅ | ✅ | ✅ |
| SPV | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ |
| PLANTATION | ✅ | ✅ | ✅ |
| FO / BD / lainnya | ✅ | ❌ | ❌ |

---

## Risks / Blind Spots

| Risiko | Keterangan |
|---|---|
| **Tidak ada Prisma transaction di beberapa mutasi** | `afa-stock.ts` (receiveSpvStockRequest) menggunakan `createMany` terpisah, bukan `$transaction`. Jika gagal di tengah, data bisa inconsistent. |
| **Multiple PrismaClient instances** | Setiap file `actions/*.ts` dan beberapa `api/*.ts` membuat `new PrismaClient()` sendiri. Tidak ada singleton global — risiko connection pool exhaustion di serverless. |
| **Satuan stok (gramasi vs kemasan)** | Kritis: semua `quantity` di Ledger harus dalam gramasi (ml/gr). Konversi terjadi di UI. Jika user input dalam kemasan tanpa konversi sebelum simpan, data akan salah (bug historis sudah diperbaiki dengan `revert-ledger.js`). |
| **WAHA config dinamis** | URL, API key, nomor WA disimpan di tabel `SystemConfig` di DB (bukan env). Jika DB tidak bisa diakses saat approval, notifikasi WA akan silent fail (tidak throw error). |
| **Accurate API timeout** | `createSalesInvoice` dipanggil saat WHM approve. Jika Accurate timeout, approval gagal keseluruhan — tidak ada retry mechanism. |
| **Vercel Cron timezone** | Cron `0 0 * * *` berjalan di UTC (= 07:00 WIB). Data Accurate yang diupdate malam hari WIB baru tersinkron pagi berikutnya. |
| **Offline queue** | `lib/offline-db.ts` menggunakan IndexedDB untuk draft offline, namun implementasi sinkronisasi ke server tidak sepenuhnya terpetakan dari analisis ini. |
| **Script migration root** | `migrate-ledger.js`, `fix-ledger.js`, `revert-ledger.js`, `migrate-categories.js` di root berpotensi dijalankan berulang. Tidak ada idempotency guard kuat. |
| **Android TWA** | File `.aab`/`.apk` di root bukan bagian dari build pipeline Next.js — tidak bisa dipetakan lebih lanjut tanpa membaca kode Android di folder `app/`. |
| **SopCategory vs Sop.category desync** | Hapus `SopCategory` tidak otomatis update `Sop.category` yang sudah memakai nama itu. Perlu rename terlebih dahulu sebelum hapus untuk menjaga konsistensi. |
| **Supabase pooler port** | `prisma db push` / DDL statements gagal via port 6543 (PgBouncer). Wajib gunakan port 5432 (session mode) untuk migrasi skema. Sudah terdokumentasi di bagian Project Summary. |
| **PDF di react-pdf** | Ukuran PDF sangat besar (>10MB) berpotensi timeout saat diproxy via `/api/sop/proxy` karena Vercel function timeout 10 detik pada free plan. Batasi ukuran upload max 20MB di UI. |
