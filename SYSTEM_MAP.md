# SYSTEM_MAP — Gamagronomist (Agrolens)

---

## Project Summary

**Tujuan:** Sistem manajemen aktivitas lapangan agronomi untuk perusahaan agrokimia. Mengelola distribusi stok produk (pestisida/pupuk) dari gudang pusat ke AFA → FO / BD, pencatatan kegiatan lapangan (demplot, kunjungan kios, CB, spot demplot, video konten), visualisasi fase tanam padi spasial (SIMOTANDI), antrean offline (PWA), serta integrasi stok & SO dengan Accurate Online ERP. Dilengkapi modul SOP (Standard Operating Procedure) untuk manajemen dokumen operasional tim.

**Tech Stack Utama:**
| Layer | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Next.js 15 (App Router, Server Actions) |
| Database | PostgreSQL via Supabase (pooler port 6543 untuk Prisma, port 5432 untuk `db push`/migrasi) |
| ORM | Prisma 6 dengan centralized singleton (`@/lib/prisma`) |
| Auth | JWT (jose) + bcryptjs, session di HttpOnly cookie (7 hari), guard di `middleware.ts` |
| Notifikasi WA | WAHA (WhatsApp HTTP API) self-hosted |
| Upload Media | Cloudinary (unsigned preset untuk foto lapangan, raw upload untuk PDF SOP) |
| PDF Viewer | Google Docs Viewer Embed (`<iframe>`) langsung ke Cloudinary raw URL |
| Geospatial & Peta | Leaflet, React-Leaflet, GADM Level 2 GeoJSON boundaries (Jateng, DIY, Jatim) |
| Visualisasi & Export | Recharts, ExcelJS, jsPDF |
| PWA & Offline Engine | Service Worker v7 (`public/sw.js`), IndexedDB (`idb`, `lib/offline-db.ts`), Offline Sync Queue (`/api/reports/sync-offline`) |
| ERP Integrasi | Accurate Online API (HMAC-SHA256 auth) |
| Deploy Target | Self-Hosted VPS via Coolify (sebelumnya Vercel) |
| Scheduler / Crons | Coolify Scheduled Tasks / Linux Crontab (memanggil internal Route Handlers via `CRON_SECRET`) |
| Mobile | Android TWA (Trusted Web Activity) — file `.aab` & `.apk` di root |

**Pola Arsitektur:** Monolith Next.js — Server Actions (`src/app/actions/`) untuk seluruh mutasi data transaksional, Route Handlers (`src/app/api/`) untuk sinkronisasi, cron, dan query data client-side. Ledger double-entry sebagai inti pencatatan inventori. Centralized Prisma Client singleton di `src/lib/prisma.ts`.

> **Catatan Supabase:** `.env` menggunakan `DATABASE_URL` dengan host pooler port `6543` (PgBouncer). Untuk `prisma db push` / migrasi skema wajib menggunakan port `5432` (session mode / Direct URL) karena PgBouncer tidak mendukung DDL statements.

---

## Core Logic Flow (Function-Level)

### 1. Autentikasi & Akun
```
Login:
/login page → login()[actions/auth.ts] → prisma.user.findUnique → bcrypt.compare
  → encrypt(JWT payload) → set cookie 'session' (HttpOnly, 7 hari)
  → middleware.ts: decrypt(cookie) → block if !userId || !isActive → redirect /login

Registrasi / Request Akun:
/register → submitAccountRequest()[actions/register.ts]
  → bcrypt.hash(password) → prisma.accountRequest.upsert(status: PENDING)
  → Admin approve di /dashboard/master/user-requests → prisma.user.create + update status APPROVED

Profil & Password:
changePassword()[actions/auth.ts] → verifikasi bcrypt → hash → prisma.user.update
updateEmail() / updatePhone() / updateProfilePhoto()[actions/auth.ts]
resetPasswordWithEmail()[actions/auth.ts] → verifikasi email terdaftar → set password baru
```

### 2. AFA Request Stok (Gudang Utama — 4 Tahap Approval)
```
/dashboard/stock → submitAfaStockRequest()[actions/afa-stock.ts]
  → prisma.request.create (status: SUBMITTED, warehouseSource: MAIN)
  → notify SPV in-app + WA (waha.ts → SystemConfig[wa_spv])

SPV approve → approveSpvStockRequest()[actions/afa-stock.ts]
  → prisma.request.update (status: APPROVED_SPV) → notify FAM (WA + in-app)

FAM approve → approveFamStockRequest()[actions/afa-stock.ts]
  → prisma.request.update (status: APPROVED_FAM) → notify WHM (WA + in-app)

WHM approve → approveWhmStockRequest()[actions/afa-stock.ts]
  → prisma.request.update (status: APPROVED_WHM) → notify AFA (WA + in-app)

SPV Terima Stok (Finalisasi) → receiveSpvStockRequest()[actions/afa-stock.ts]
  → createSalesInvoice()[lib/accurate.ts] → POST Accurate /sales-invoice/save.do
    (harga diambil via fetchItemPrices dengan kategori "CJ R2")
  → prisma.ledger.createMany (transactionType: STOCK_IN_GUDANG, qty = raw gramasi)
  → prisma.request.update (status: APPROVED, accurateInvoiceNo: invoiceNo)
  → notify AFA (WA + in-app)
```

### 3. AFA Request Stok (Gudang Sampel)
```
/dashboard/stock → submitAfaStockRequest()[actions/afa-stock.ts] (warehouseSource: SAMPLE)
  → prisma.request.create (status: SUBMITTED)
  → SPV approve: deduct SampleLedger (SAMPLE_OUT) + add Ledger AFA (STOCK_IN_GUDANG)
```

### 4. BD (Business Development) Request Stok
```
/dashboard/stock/bd-request → POST /api/bd-requests
  → Simpan BdRequest + BdRequestDetail (relasi ke BdCustomer & Product)
  → SPV review & approve → update status APPROVED & deduct/allocate stok BD
```

### 5. FO Request Produk ke AFA (Transfer Stok)
```
/dashboard/demoplot/request → submitRequestDemoPlot()[actions/request.ts]
  → prisma.request.create (status: SUBMITTED, role FO/INTERN)
  → AFA approve: approveRequest()[actions/approve.ts]
    ├── Potong stok AFA: prisma.ledger.create (transactionType: TRANSFER_TO_FO, qty: −X)
    ├── Tambah stok FO: prisma.ledger.create (transactionType: RECEIVE_FROM_AFA, qty: +X)
    └── prisma.request.update (status: APPROVED)
```

### 6. Realisasi Demplot (Standalone & Berulang)
```
Direct / Standalone Demplot:
/dashboard/demoplot/new → submitStandaloneDemoPlot()[actions/standalone-demoplot.ts]
  → Reverse Geo GPS via resolveAreaIdFromCoords()
  → prisma.farmer.findFirst / create
  → prisma.request.create (status: APPROVED, auto-approved standalone)
  → prisma.demoPlot.create (isStandalone: true) + DemoPlotDetail[]
  → Potong stok user: prisma.ledger.create (transactionType: USAGE_DEMOPLOT, qty: −X)

Realisasi Sesi Berulang (Multi-Session Execution):
/dashboard/demoplot/[id]/execute → submitExecutionDemoPlot()[actions/execute.ts]
  → Upload dokumentasi & GPS capture
  → Potong stok tambahan jika ada penggunaan produk baru (USAGE_DEMOPLOT)
  → update DemoPlot (isFinalSession, hasil observasi, status COMPLETED jika final)
```

### 7. Spot Demplot
```
/dashboard/reports/spot-demplot → submitSpotDemplot()[actions/spot-demplot.ts]
  → GPS reverse area mapping
  → prisma.spotDemplot.create (data gulma, tanaman, hasil observasi, foto)
  → Potong stok user untuk produk internal: prisma.ledger.create (USAGE_SPOT_DEMOPLOT, qty: −X)
```

### 8. Laporan Lapangan & Offline Sync Engine
```
Online Flow:
/dashboard/reports/[cb|kios|gathering|company|video] → submit*Report()[actions/report.ts]
  → Reverse GPS area mapping → prisma.[Model].create

Offline Flow (PWA):
1. User tanpa sinyal submit form → dicegat oleh useOfflineForm hook / offline-db.ts
2. Payload + Base64 image disimpan ke IndexedDB (store: offlineReportsQueue)
3. Halaman /dashboard/offline-queue mendeteksi antrean pending
4. Saat online / klik "Sinkronkan Sekarang":
   → POST /api/reports/sync-offline (batch payload)
   → Server loop items: upload image ke Cloudinary → simpan model DB → potong ledger jika ada
   → Client menghapus item terverifikasi dari IndexedDB
```

### 9. SIMOTANDI Spasial & Fase Tanam Padi
```
Data Fetching / Ingestion:
1. Scheduled Task / Cron trigger: GET /api/simotandi-sync
   (Fallback darurat jika VPS diblokir WAF Kementan: node scripts/sync-simotandi-local.mjs)
2. Scrape daftar periode dari simotandi.pertanian.go.id → scrapePeriods()[lib/simotandi.ts]
3. Download tabel luas fase tanam (Bera, Olah Tanah, Vegetatif 1-2, Generatif 1-2, Panen)
4. Upsert ke tabel SimotandiPeriode & SimotandiWilayah

Peta Spasial (Frontend):
/dashboard/demoplot/map atau MapView.tsx:
  → Fetch GeoJSON master batas kabupaten: /geojson/jateng-diy-jatim.geojson
  → Fetch data fase SIMOTANDI terbaru: GET /api/simotandi-sync
  → Leaflet render GeoJSON polygon dengan pewarnaan choropleth berdasarkan dominasi fase
```

### 10. SOP (Standard Operating Procedure)
```
Upload & Simpan:
/dashboard/sop → Upload PDF ke Cloudinary via /api/sop/upload (resource_type: raw)
  → Simpan metadata: POST /api/sop → prisma.sop.create { title, category, fileUrl, fileName }

Render Dokumen:
/dashboard/sop/SopClient.tsx → Menggunakan <iframe> dengan Google Docs Viewer Embed:
  <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`} />

Kelola Kategori:
CRUD via /api/sop-categories
  → Rename kategori memicu prisma.sop.updateMany untuk sinkronisasi string nama kategori di dokumen SOP
```

### 11. Stok Opname & Adjustment
```
Opname Mandiri:
/dashboard/opname → submitStockOpname()[actions/opname.ts]
  → Hitung saldo sistem via getStockBalance(userId)
  → Hitung variance = physicalStock - systemStock
  → Simpan ke prisma.stockOpname & prisma.stockOpnameDetail (status: SUBMITTED)

Approval SPV:
/dashboard/opname/spv → approveStockOpname()[actions/opname-spv.ts]
  → Dalam prisma.$transaction:
      - Loop details: jika variance != 0 buat Ledger (ADJUSTMENT_PLUS / ADJUSTMENT_MINUS)
      - Update StockOpname (status: APPROVED)

Manual Adjustment oleh Admin/SPV:
/dashboard/stock → adjustStock()[actions/stock-admin.ts]
  → Buat entry Ledger ADJUSTMENT_PLUS / ADJUSTMENT_MINUS dengan snapshot area user
```

### 12. Monthly Planning & Maintenance Mode
```
AFA Plan:
/dashboard/demoplot/plan → saveAfaPlan() / getAfaPlan()[actions/afa-plan.ts]
  → Kelola rencana kerja bulanan (target petani, luas lahan, kebutuhan produk) per AFA

Maintenance Mode:
/dashboard/settings/system → toggleMaintenanceMode()[actions/system.ts]
  → Update key maintenance_mode di SystemConfig
  → middleware.ts membaca status: jika aktif, redirect semua non-admin ke /maintenance
```

---

## Clean Tree

```
Gamagronomist/
├── prisma/
│   ├── schema.prisma              ← Skema database PostgreSQL
│   └── seed.ts                    ← Seeder data master awal
├── public/                        ← Aset statis, manifest PWA, Service Worker, GeoJSON
│   ├── sw.js                      ← Service Worker v7 (PWA caching & offline queue)
│   ├── manifest.json              ← Web App Manifest PWA
│   └── geojson/jateng-diy-jatim.geojson ← Batas wilayah kabupaten (GADM)
├── scripts/                       ← Utility & Background Maintenance Scripts
│   ├── build-geojson.mjs          ← Kompresi & build batas wilayah GADM
│   ├── sync-simotandi-local.mjs   ← Runner manual sync SIMOTANDI lokal (bypass WAF)
│   ├── backfill-simotandi.mjs     ← Backfill data historis SIMOTANDI
│   └── migrate-categories.js      ← Seeder awal master kategori SOP
├── src/
│   ├── middleware.ts              ← Guard JWT, Session Active Check, Maintenance Gate
│   ├── app/
│   │   ├── layout.tsx & page.tsx  ← Root Layout & Redirector
│   │   ├── globals.css            ← Tailwind v4 styling & Design tokens
│   │   ├── maintenance/           ← Halaman Maintenance Mode
│   │   ├── (auth)/                ← Login, Register, Forgot Password
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         ← Shell Dashboard (Sidebar, Header, Notif Bell)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx       ← Main KPI & Activity Overview
│   │   │       ├── offline-queue/ ← Antrean Form Offline
│   │   │       ├── demoplot/      ← List, New Standalone, Request FO, Plan AFA, Map, Exec
│   │   │       ├── stock/         ← Saldo Stok, In Mandiri, History, Sample, BD Request
│   │   │       ├── reports/       ← CB, Kios, Gathering, Company, Video, Spot Demplot
│   │   │       ├── master/        ← Users, User Requests, Products, Stores, Areas, Import
│   │   │       ├── opname/        ← Opname Mandiri & Approval SPV
│   │   │       ├── so/ & sop/     ← Accurate Sales Order & Dokumen SOP (Iframe Viewer)
│   │   │       └── settings/      ← Profil Akun, WAHA Config, System Settings
│   │   ├── actions/               ← Server Actions (Semua Mutasi DB)
│   │   │   ├── afa-plan.ts, afa-stock.ts, approve.ts, auth.ts, bulk-import.ts
│   │   │   ├── cb-admin.ts, demoplot-admin.ts, execute.ts, kpi.ts, kpi-trend.ts
│   │   │   ├── master.ts, migration.ts, opname.ts, opname-spv.ts, region.ts
│   │   │   ├── register.ts, report.ts, request.ts, sample-stock.ts, spot-demplot.ts
│   │   │   └── standalone-demoplot.ts, stock.ts, stock-admin.ts, system.ts
│   │   └── api/                   ← Route Handlers (JSON API & Cron Endpoints)
│   │       ├── accurate-branches/, accurate-item-detail/, accurate-so/
│   │       ├── accurate-sync/, accurate-sync-cron/, accurate-sync-customers/
│   │       ├── bd-customers/, bd-requests/, cb-farmers/, cb-stats/
│   │       ├── demoplot-map/, demoplot-stats/, leaderboard/, notifications/
│   │       ├── reports/sync-offline/, simotandi-sync/, sop/, sop-categories/
│   │       └── target-data/, upload/
│   ├── components/                ← Reusable React Components
│   │   ├── MapView.tsx, DemoPlotMap.tsx, AfaStockRequestTable.tsx, TeamStockTable.tsx
│   │   ├── StockAdjustmentModal.tsx, KpiDashboard.tsx, TargetDashboard.tsx
│   │   ├── GpsCapture.tsx, ImageUploader.tsx, NotificationBell.tsx, RegionSelect.tsx
│   │   └── map/* (Polygon layers, Legends, Controls)
│   └── lib/                       ← Core Business Logic & Helpers
│       ├── prisma.ts (Singleton), auth.ts, accurate.ts, accurate-sync.ts
│       ├── simotandi.ts, simotandi-fase.ts, waha.ts, area-resolver.ts
│       ├── geocode.ts, offline-db.ts, ledger/stock.ts
├── .env & .env.example            ← Secrets & Template Environment
└── twa-manifest.json              ← Konfigurasi Android Trusted Web Activity
```

---

## Module Map (The Chapters)

### 1. Server Actions (`src/app/actions/`)
| File | Fungsi Utama | Peran |
|---|---|---|
| `auth.ts` | `login`, `logout`, `changePassword`, `updateEmail`, `updatePhone`, `resetPasswordWithEmail`, `updateProfilePhoto` | Manajemen sesi JWT, kredensial, dan profil pengguna |
| `afa-stock.ts` | `submitAfaStockRequest`, `approveSpv/Fam/WhmStockRequest`, `receiveSpvStockRequest`, `rejectAfaStockRequest` | Alur 4 tahap approval pengajuan stok AFA & integrasi faktur Accurate |
| `afa-plan.ts` | `saveAfaPlan`, `getAfaPlan`, `deleteAfaPlan` | Perencanaan target bulanan komoditas dan kebutuhan produk per AFA |
| `approve.ts` | `approveRequest`, `rejectRequest` | Approval permintaan stok FO oleh AFA (transfer ledger atomic) |
| `standalone-demoplot.ts` | `submitStandaloneDemoPlot` | Pembuatan demplot langsung (auto-approve) & pemotongan stok |
| `execute.ts` | `submitExecutionDemoPlot`, `deleteDemoPlotSession` | Pencatatan sesi monitoring demplot lanjutan & foto dokumentasi |
| `spot-demplot.ts` | `submitSpotDemplot` | Laporan demplot spontan pada lahan petani + deduct stok internal |
| `report.ts` | `submitCustomerBehavior`, `submitVisitKios`, `submitFarmerGathering`, `submitCompanyActivity`, `submitContentVideo` | Pencatatan semua tipe laporan kegiatan lapangan |
| `sample-stock.ts` | `addSampleStock`, `adjustSampleStock` | Penambahan & mutasi stok fisik gudang sampel oleh SPV |
| `stock.ts` | `submitStockIn` | Pencatatan penerimaan stok mandiri oleh AFA |
| `stock-admin.ts` | `adjustStock` | Penyesuaian stok manual (plus/minus) oleh Admin/SPV |
| `opname.ts` | `submitStockOpname` | Penginputan hasil opname fisik mandiri FO/AFA |
| `opname-spv.ts` | `approveStockOpname`, `rejectStockOpname` | Persetujuan opname dan eksekusi ledger adjustment dalam `$transaction` |
| `kpi.ts` | `setAreaTarget`, `getAreaKpiData`, `getAreas` | Pengaturan target KPI dan kalkulasi capaian aktual bulanan |
| `kpi-trend.ts` | `getKpiMonthlyTrend` | Agregasi tren KPI historis bulanan |
| `master.ts` | CRUD User, Product, Store, Area | Pengelolaan master data aplikasi |
| `bulk-import.ts` | `bulkImportProducts` | Parser & import data produk massal dari file Excel |
| `migration.ts` | `bulkImportAreas`, `bulkImportUsers` | Seeder migrasi data area dan pengguna |
| `register.ts` | `submitAccountRequest` | Pengajuan pendaftaran akun pengguna baru |
| `request.ts` | `submitRequestDemoPlot` | Pengajuan pengambilan produk oleh FO ke AFA |
| `system.ts` | `getSystemConfigs`, `saveSystemConfig`, `toggleMaintenanceMode` | Konfigurasi runtime WAHA, kontak pimpinan, dan mode pemeliharaan |
| `cb-admin.ts` | `deleteCustomerBehavior`, `updateCustomerBehavior` | Koreksi laporan perilaku konsumen oleh admin |
| `demoplot-admin.ts` | `deleteDemoPlot`, `updateDemoPlot` | Koreksi data demplot oleh admin |
| `region.ts` | `getRegencies`, `getDistricts`, `getVillages` | Proxy API wilayah administrasi Indonesia (Emsifa) |

### 2. Core Libraries (`src/lib/`)
| File | Fungsi / Fitur Utama | Peran |
|---|---|---|
| `prisma.ts` | Singleton `PrismaClient` | Menghindari connection exhaustion pool di seluruh app |
| `auth.ts` | `encrypt`, `decrypt` | Enkripsi dan dekripsi payload JWT (jose HS256) |
| `accurate.ts` | `createSalesInvoice`, `fetchAccurateItems`, `fetchItemPrices` | REST API Client untuk transaksi & master Accurate Online |
| `accurate-sync.ts` | `runAccurateSync` | Algoritma sinkronisasi master produk, SKU, & stok Accurate |
| `simotandi.ts` | `scrapePeriods`, `fetchProvinceData` | Scraper portal SIMOTANDI Kementan untuk tabel fase tanam |
| `simotandi-fase.ts` | `calculateDominantPhase` | Parser fase dominan (Bera, Olah Tanah, Vegetatif, Generatif, Panen) |
| `waha.ts` | `sendWhatsAppNotification` | Pengirim notifikasi WhatsApp via WAHA HTTP API |
| `area-resolver.ts` | `resolveAreaIdFromCoords` | Deteksi area penugasan dari GPS via AreaCoverage |
| `geocode.ts` | `reverseGeocode` | Nominatim OpenStreetMap reverse geocoding |
| `offline-db.ts` | `saveOfflineReport`, `getOfflineQueue`, `deleteOfflineItem` | IndexedDB manager untuk antrean formulir offline |
| `ledger/stock.ts` | `getStockBalance`, `getStockHistory` | Engine kalkulasi saldo inventori berbasis double-entry ledger |

---

## Data & Config

### Variabel Environment (`.env`)
| Variabel | Deskripsi |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Port 6543 untuk PgBouncer pooler, Port 5432 untuk `db push`) |
| `JWT_SECRET` | Kunci rahasia untuk enkripsi JWT session |
| `NEXT_PUBLIC_APP_URL` | URL domain publik aplikasi |
| `ACCURATE_API_TOKEN` | Token API OAuth Accurate Online |
| `ACCURATE_SIGNATURE_SECRET` | Secret HMAC-SHA256 untuk otentikasi request Accurate |
| `ACCURATE_HOST` | Host API Accurate (default: `https://zeus.accurate.id`) |
| `CLOUDINARY_CLOUD_NAME` | Nama akun Cloudinary |
| `CLOUDINARY_UPLOAD_PRESET` | Preset unsigned upload untuk media gambar |
| `CLOUDINARY_API_KEY` | API Key Cloudinary untuk upload dokumen raw PDF |
| `CLOUDINARY_API_SECRET` | API Secret Cloudinary |
| `CRON_SECRET` | Bearer token rahasia untuk memproteksi endpoint cron scheduler |

### Skema Relasi Database

```
User ───────────────┬── areaId → Area ──── AreaCoverage (kabupatenName)
 (afaId self-ref)   ├── requestsAsFo (Request[])
                    ├── requestsAsAfa (Request[])
                    ├── Ledger[] ──────── productId → Product
                    ├── SampleLedger[] ── productId → Product
                    ├── StockOpname[] ─── OpnameDetail[] → Product
                    ├── AfaPlan[] ─────── AfaPlanItem[] → Product
                    ├── BdRequest[] ───── BdRequestDetail[] → Product (customer: BdCustomer)
                    ├── Sop[] (author)
                    ├── Notification[]
                    └── Laporan:
                        ├── DemoPlot[] ──── DemoPlotDetail[] → Product
                        │               └── farmerId → Farmer
                        ├── SpotDemplot[]
                        ├── CustomerBehavior[]
                        ├── VisitKios[]
                        ├── FarmerGathering[]
                        ├── CompanyActivity[]
                        └── ContentVideo[]

SopCategory ─────── (Master kategori dokumen SOP)
Sop ─────────────── category (String), fileUrl, authorId → User

SimotandiPeriode ── SimotandiWilayah[] (Data spasial fase tanam padi)

AccountRequest ──── (Antrean registrasi akun mandiri)
SystemConfig ────── (Konfigurasi runtime: WAHA, Kontak SPV/FAM/WHM, Maintenance Mode)
KpiTarget ───────── areaId → Area (Nullable = Target Global)
Store ───────────── areaId → Area (Master toko & kios)
```

### Tipe Transaksi Ledger (`transactionType`)
| Type | Arah | Trigger / Deskripsi |
|---|---|---|
| `STOCK_IN_GUDANG` | + | Penerimaan stok dari Accurate setelah SPV menyelesaikan Step 4 |
| `TRANSFER_TO_FO` | − | AFA mentransfer stok ke FO (approval request FO) |
| `RECEIVE_FROM_AFA` | + | FO menerima produk dari AFA |
| `USAGE_DEMOPLOT` | − | Realisasi demplot mandiri atau eksekusi sesi lanjutan |
| `USAGE_SPOT_DEMOPLOT` | − | Penggunaan produk pada spot demplot |
| `DIRECT_USAGE_AFA` | − | Penggunaan produk langsung oleh AFA |
| `ADJUSTMENT_PLUS` | + | Penyesuaian stok manual / hasil opname disetujui SPV |
| `ADJUSTMENT_MINUS` | − | Penyesuaian stok minus / hasil opname disetujui SPV |

> **Aturan Satuan Inventori:** Seluruh nilai `quantity` pada tabel `Ledger` disimpan dalam satuan volume/berat terkecil (mililiter `ml` atau gram `gr` sesuai `unitGramasi`). Tampilan dalam bentuk kemasan (Botol, PCS, Bungkus) dihitung secara dinamis di UI dengan membagi `quantity` terhadap `Product.gramasiPerUnit`.

---

## Background Tasks & Scheduler (In-Process & Coolify / Self-Hosted VPS)

Aplikasi memiliki **In-Process Scheduler otomatis** yang berjalan langsung di background Node.js runtime saat container/server menyala (`src/instrumentation.ts` → `src/lib/scheduler.ts`). Selain itu, background tasks juga tetap dapat dipicu secara eksternal melalui **Coolify Scheduled Tasks**, **Linux Crontab**, atau request HTTP manual:

| Task / Job | Jadwal Otomatis | Internal Handler / Endpoint | Fungsi |
|---|---|---|---|
| **Accurate Sync** | Setiap hari 00:00 UTC (07:00 WIB) | `runAccurateSync()` / `GET /api/accurate-sync-cron` | Sinkronisasi master produk, SKU, dan update stok gudang dari Accurate |
| **SIMOTANDI Sync** | Setiap hari 22:00 UTC (05:00 WIB) | `runSimotandiSync()` / `GET /api/simotandi-sync` | Menarik tabel luas fase tanam padi dari portal SIMOTANDI Kementan |
| **Scheduler Status** | On-Demand | `GET /api/scheduler` & `POST /api/scheduler` | Monitoring status runtime timer internal dan trigger manual job |

**Contoh Perintah Eksekusi Manual / Coolify Task / Crontab:**
```bash
# Accurate sync:
curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/accurate-sync-cron > /dev/null 2>&1

# SIMOTANDI sync:
curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/simotandi-sync > /dev/null 2>&1

# Cek status runtime scheduler:
curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/scheduler
```

> **Fallback SIMOTANDI:** Jika IP server VPS terkena pembatasan firewall (HTTP 403 Forbidden) oleh server kementerian, gunakan script runner lokal:
> ```bash
> node scripts/sync-simotandi-local.mjs
> ```

---

## External Integrations

| Service | Tujuan | Implementasi |
|---|---|---|
| **Accurate Online API** | Sinkronisasi master produk, pembuatan Sales Invoice, lookup harga, sales order | `lib/accurate.ts`, `lib/accurate-sync.ts`, `/api/accurate-*` |
| **WAHA (WhatsApp HTTP API)** | Notifikasi pesan WhatsApp otomatis ke penanggung jawab alur stok | `lib/waha.ts` dipanggil dari `actions/afa-stock.ts` |
| **Cloudinary** | Penyimpanan foto dokumentasi kegiatan lapangan dan file PDF dokumen SOP | `/api/upload/route.ts`, `/api/sop/upload/route.ts` |
| **Google Docs Viewer** | Render inline dokumen PDF SOP di peramban web dan mobile tanpa dependensi binary lokal | Native iframe di `SopClient.tsx` |
| **SIMOTANDI Portal (Kementan)** | Sumber data fase pertumbuhan tanaman padi per kabupaten | `lib/simotandi.ts`, `/api/simotandi-sync` |
| **Nominatim (OpenStreetMap)** | Reverse geocoding koordinat GPS ke nama kabupaten | `lib/geocode.ts` → `lib/area-resolver.ts` |
| **Supabase PostgreSQL** | Database transaksional utama | `DATABASE_URL` via PgBouncer (6543) dan Direct Session (5432) |
| **Emsifa Wilayah API** | Master data provinsi, kabupaten, kecamatan, dan desa di Indonesia | `actions/region.ts` |

---

## Role & Hak Akses

| Fitur / Modul | ADMIN | SPV | AFA / PLANTATION | FO / INTERN | BD |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard KPI & Map** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Request Stok Gudang Utama** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approval Stok AFA** | Step 1-4 | Step 1 & 4 | ❌ | ❌ | ❌ |
| **Request Stok BD** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Request Stok FO → AFA** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Approve Request FO** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Laporan Demplot & Kegiatan** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Gudang Sampel (SPV)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Stok Opname Mandiri** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approval Stok Opname** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lihat Dokumen SOP** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Upload / Kelola SOP** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Master Data & Users** | ✅ | ✅ (Read) | ❌ | ❌ | ❌ |
| **System & Maintenance Config** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Risks / Blind Spots

| Risiko | Mitigasi / Status Aktual |
|---|---|
| **Prisma Client Connection Exhaustion** | **Terselesaikan:** Seluruh Server Actions dan API Route kini menggunakan singleton global dari `@/lib/prisma`. |
| **Accurate Sales Invoice Timing** | Sales Invoice dibuat otomatis saat SPV mengonfirmasi penerimaan stok (`receiveSpvStockRequest`). Jika Accurate timeout, transaksi request ditahan agar tidak terjadi selisih stok. |
| **WAF / IP Blocking SIMOTANDI** | Server Kementan terkadang menolak IP Datacenter/VPS (HTTP 403). Disediakan script lokal `scripts/sync-simotandi-local.mjs` yang dapat dijalankan secara berkala dari jaringan lokal kantor. |
| **Ketergantungan Google Docs Viewer** | Viewer PDF SOP memanfaatkan Google Docs Viewer embed. Dokumen harus memiliki URL Cloudinary yang dapat diakses publik via internet. |
| **Peralihan Cron dari Vercel ke Coolify** | `vercel.json` tidak lagi dieksekusi secara otomatis di Coolify. Cron wajib didaftarkan di menu Scheduled Tasks Coolify atau host Crontab VPS. |
| **Port Pooler Supabase (6543 vs 5432)** | DDL schema push / migrasi skema Prisma (`prisma db push`) akan gagal jika diarahkan ke port 6543 (PgBouncer). Wajib gunakan Direct Port 5432 saat melakukan perubahan skema. |
| **Integritas Satuan Ledger (Gramasi vs Kemasan)** | Semua entri mutasi wajib disimpan dalam satuan terkecil (`ml` atau `gr`). Konversi ke kemasan fisik hanya dilakukan pada lapisan presentasi UI. |
| **WAHA Silent Failure** | Pengiriman WhatsApp dikonfigurasi secara non-blocking; kegagalan pada layanan WAHA tidak menggagalkan mutasi data database utama. |
