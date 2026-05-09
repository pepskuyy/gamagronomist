# SYSTEM_MAP — Gamagronomist (Agrolens)

---

## Project Summary

**Tujuan:** Sistem manajemen aktivitas lapangan agronomi untuk perusahaan agrokimia. Mengelola distribusi stok produk (pestisida/pupuk) dari gudang pusat ke AFA → FO, pencatatan kegiatan lapangan (demplot, kunjungan kios, CB, spot demplot), serta integrasi stok dengan Accurate Online ERP.

**Tech Stack Utama:**
| Layer | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Next.js 15 (App Router, Server Actions) |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 6 |
| Auth | JWT (jose) + bcryptjs, session di HttpOnly cookie (7 hari) |
| Notifikasi WA | WAHA (WhatsApp HTTP API) self-hosted |
| Upload Foto | Cloudinary (unsigned preset) |
| ERP Integrasi | Accurate Online API (HMAC-SHA256 auth) |
| Deploy | Vercel (dengan Cron job harian) |
| Mobile | Android TWA (Trusted Web Activity) — file `.aab` & `.apk` di root |

**Pola Arsitektur:** Monolith Next.js — Server Actions untuk mutasi data, Route Handlers (`/api/*`) untuk query data client-side. Ledger double-entry sebagai inti pencatatan stok. Tidak ada state management eksternal (Zustand/Redux). Middleware JWT di edge runtime.

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

---

## Clean Tree

```
Gamagronomist/
├── prisma/
│   ├── schema.prisma          ← Definisi semua model DB
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
│   │   │       └── so/                 ← Sales Order (Accurate SO)
│   │   ├── actions/            ← Server Actions (mutasi data)
│   │   │   ├── auth.ts         login, logout, changePassword, resetPassword
│   │   │   ├── afa-stock.ts    submitAfaStockRequest + 4 approval steps
│   │   │   ├── approve.ts      approveRequest (AFA→FO transfer)
│   │   │   ├── standalone-demoplot.ts  submitStandaloneDemoPlot, submitContinueDemoPlot
│   │   │   ├── spot-demplot.ts submitSpotDemplot, deleteSpotDemplot
│   │   │   ├── sample-stock.ts addSampleStock, adjustSampleStock, removeSampleProduct
│   │   │   ├── report.ts       CRUD laporan (CB, kios, gathering, company, video)
│   │   │   ├── master.ts       CRUD users, products, stores, areas, targets
│   │   │   ├── kpi.ts          getKpiData, setKpiTargets
│   │   │   ├── opname.ts       submitOpname (FO/AFA)
│   │   │   ├── opname-spv.ts   approveOpname, rejectOpname (SPV)
│   │   │   ├── stock-admin.ts  adjustStockAdmin (ADMIN override)
│   │   │   ├── bulk-import.ts  importUsersExcel, importStoresExcel
│   │   │   ├── register.ts     submitAccountRequest, approveAccountRequest
│   │   │   ├── request.ts      submitFoRequest (FO→AFA)
│   │   │   ├── migration.ts    data migration helpers (admin only)
│   │   │   └── region.ts       getRegions
│   │   └── api/                ← Route Handlers (GET data untuk client)
│   │       ├── auth/           login/logout endpoint (alt path)
│   │       ├── products/       daftar produk
│   │       ├── stock/          balance, summary per user/area
│   │       ├── spv-stock/      stok SPV dari Accurate (spvStock field)
│   │       ├── sample-stock/   saldo + riwayat gudang sampel
│   │       ├── sample-stock-for-afa/  stok sampel yg bisa dilihat AFA
│   │       ├── ledger/         riwayat transaksi ledger
│   │       ├── afa-stock/      daftar request stok AFA
│   │       ├── users/          daftar user + subordinates
│   │       ├── master/         areas, stores, farmers, area-coverage
│   │       ├── accurate-sync/  trigger sync manual
│   │       ├── accurate-sync-cron/  endpoint cron Vercel
│   │       ├── accurate-so/    create Sales Order Accurate
│   │       ├── accurate-branches/   daftar cabang Accurate
│   │       ├── accurate-item-detail/  detail item Accurate
│   │       ├── accurate-sync-customers/  sync customer Accurate→DB
│   │       ├── demoplot-map/   data GPS demplot untuk peta
│   │       ├── demoplot-request/  daftar request demplot
│   │       ├── demoplot-stats/  statistik demplot
│   │       ├── reports/        export/query laporan
│   │       ├── cb-farmers/     data petani CB
│   │       ├── cb-stats/       statistik CB
│   │       ├── leaderboard/    ranking area/user
│   │       ├── target-data/    data target KPI
│   │       ├── notifications/  baca/tandai notifikasi
│   │       ├── upload/         upload foto → Cloudinary
│   │       ├── system-config/  baca/tulis SystemConfig (WA, dll)
│   │       ├── migration/      endpoint migrasi data admin
│   │       └── admin/          geocode-test, tools admin
│   ├── components/             ← UI Components (Client)
│   │   ├── AfaStockRequestTable.tsx   tabel pengajuan stok + approval UI
│   │   ├── TeamStockTable.tsx         pantauan stok tim (SPV/Admin)
│   │   ├── StockAdjustmentModal.tsx   modal penyesuaian stok per user
│   │   ├── KpiDashboard.tsx           dashboard KPI area
│   │   ├── KpiFieldDashboard.tsx      dashboard KPI field user
│   │   ├── TargetDashboard.tsx        manajemen target KPI
│   │   ├── DemoPlotMap.tsx            peta demplot (Leaflet)
│   │   ├── DemoPlotReportTable.tsx    tabel laporan demplot
│   │   ├── ImportModal.tsx            modal import Excel
│   │   ├── MigrationImportModal.tsx   modal import migrasi data
│   │   ├── ImageUploader.tsx          upload foto ke /api/upload
│   │   ├── GpsCapture.tsx             capture koordinat GPS
│   │   ├── NotificationBell.tsx       bell + dropdown notifikasi
│   │   ├── RegionSelect.tsx           pilih provinsi/kab/kec (cascading)
│   │   ├── AreaLeaderboard.tsx        leaderboard per area
│   │   └── [lainnya...]               form profil, filter, pager, chart
│   ├── lib/
│   │   ├── auth.ts             encrypt/decrypt JWT (jose)
│   │   ├── accurate.ts         fetchAccurateItems, createSalesInvoice, fetchItemPrices, fetchAccurateCustomers
│   │   ├── accurate-sync.ts    runAccurateSync (upsert Product dari Accurate)
│   │   ├── waha.ts             sendWhatsApp, sendWhatsAppBulk, getMsgTemplate, getRolePhones
│   │   ├── area-resolver.ts    resolveAreaIdFromCoords (GPS→areaId via AreaCoverage)
│   │   ├── geocode.ts          getKabupatenFromCoords (Nominatim OSM reverse geocode)
│   │   ├── kpi-filters.ts      buildKpiWhere (filter query KPI)
│   │   ├── offline-db.ts       IndexedDB helper untuk offline queue
│   │   └── ledger/
│   │       └── stock.ts        getStockBalance, insertStockInGudang, transferAfaToFo
│   └── hooks/                  ← Custom React hooks (Not found / minimal)
├── .env                        ← Variabel environment aktif (tidak di-commit)
├── .env.example                ← Template variabel environment
├── vercel.json                 ← Konfigurasi Cron (accurate-sync-cron, daily 00:00 UTC)
├── next.config.ts              ← Konfigurasi Next.js
├── prisma/schema.prisma        ← Skema database
└── twa-manifest.json           ← Konfigurasi Android TWA
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
| `api/upload/route.ts` | `POST()` | Upload foto ke Cloudinary, resize + compress via URL transformation |
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
       └── [laporan: CB, VisitKios, Gathering, Company, Video, SpotDemplot]

Request ──── RequestDetail[] → Product
         └── DemoPlot[] ──── DemoPlotDetail[] → Product
                         └── farmerId → Farmer

Ledger: userId + productId + transactionType + quantity (±) + referenceId + snapshotAreaId
SampleLedger: userId + productId + transactionType + quantity (±)

StockOpname ── OpnameDetail[] → Product

KpiTarget ── areaId → Area (nullable = global)
```

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

### Folder Output/Artifacts
| Path | Isi |
|---|---|
| `.next/` | Build output Next.js (excluded dari analisis) |
| `app-release-signed.apk` | APK Android TWA rilis |
| `app-release-bundle.aab` | AAB untuk Google Play |

---

## External Integrations

| Service | Tujuan | Modul Pemangil |
|---|---|---|
| **Accurate Online API** | Sync master produk, buat Sales Invoice, lookup harga, daftar customer | `lib/accurate.ts`, `lib/accurate-sync.ts`, `api/accurate-sync*`, `api/accurate-so/` |
| **WAHA (WhatsApp HTTP API)** | Kirim notifikasi WA ke SPV/FAM/WHM/AFA di setiap step approval | `lib/waha.ts` → dipanggil dari `actions/afa-stock.ts` |
| **Cloudinary** | Upload & resize foto lapangan (demplot, CB, profil) | `api/upload/route.ts` |
| **Nominatim (OpenStreetMap)** | Reverse geocode GPS → nama kabupaten untuk resolusi area | `lib/geocode.ts` → `lib/area-resolver.ts` |
| **Neon PostgreSQL** | Database production serverless | `DATABASE_URL` di `.env`, seluruh Prisma client |
| **Vercel Cron** | Trigger sync Accurate harian (00:00 UTC) | `vercel.json` → `api/accurate-sync-cron/` |

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
| **Script migration root** | `migrate-ledger.js`, `fix-ledger.js`, `revert-ledger.js` di root berpotensi dijalankan berulang dan menyebabkan double-multiplication. Tidak ada idempotency guard. |
| **Android TWA** | File `.aab`/`.apk` di root bukan bagian dari build pipeline Next.js — tidak bisa dipetakan lebih lanjut tanpa membaca kode Android di folder `app/`. |
