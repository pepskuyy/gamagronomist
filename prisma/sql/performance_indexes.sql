-- ============================================================
-- Index Performa untuk Tabel Inti (Ledger, Request, Notification, Laporan)
-- Schema: gamagronomist
--
-- Sinkron dengan deklarasi @@index di prisma/schema.prisma. Nama index
-- mengikuti konvensi Prisma (<Model>_<kolom>_idx).
--
-- Catatan: Keyword CONCURRENTLY dihapus agar script ini bisa langsung
-- dijalankan sekali klik (all-at-once) di Supabase SQL Editor
-- tanpa error "25001: cannot run inside a transaction block".
-- Pembuatan index pada skala data saat ini selesai dalam <1 detik.
-- ============================================================

-- ── User ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "User_role_idx"
    ON gamagronomist."User"("role");
CREATE INDEX IF NOT EXISTS "User_afaId_idx"
    ON gamagronomist."User"("afaId");

-- ── Ledger (saldo stok, histori, dashboard) ─────────────────
CREATE INDEX IF NOT EXISTS "Ledger_userId_productId_idx"
    ON gamagronomist."Ledger"("userId", "productId");
CREATE INDEX IF NOT EXISTS "Ledger_userId_createdAt_idx"
    ON gamagronomist."Ledger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Ledger_referenceId_idx"
    ON gamagronomist."Ledger"("referenceId");
CREATE INDEX IF NOT EXISTS "Ledger_createdAt_idx"
    ON gamagronomist."Ledger"("createdAt");

-- ── Request ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Request_foId_status_idx"
    ON gamagronomist."Request"("foId", "status");
CREATE INDEX IF NOT EXISTS "Request_afaId_status_idx"
    ON gamagronomist."Request"("afaId", "status");
CREATE INDEX IF NOT EXISTS "Request_status_createdAt_idx"
    ON gamagronomist."Request"("status", "createdAt");

-- ── SampleLedger ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "SampleLedger_userId_productId_idx"
    ON gamagronomist."SampleLedger"("userId", "productId");
CREATE INDEX IF NOT EXISTS "SampleLedger_referenceId_idx"
    ON gamagronomist."SampleLedger"("referenceId");

-- ── RequestDetail ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "RequestDetail_requestId_idx"
    ON gamagronomist."RequestDetail"("requestId");

-- ── DemoPlot & detail ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS "DemoPlot_requestId_idx"
    ON gamagronomist."DemoPlot"("requestId");
CREATE INDEX IF NOT EXISTS "DemoPlot_date_idx"
    ON gamagronomist."DemoPlot"("date");
CREATE INDEX IF NOT EXISTS "DemoPlot_snapshotAreaId_date_idx"
    ON gamagronomist."DemoPlot"("snapshotAreaId", "date");
CREATE INDEX IF NOT EXISTS "DemoPlotDetail_demoPlotId_idx"
    ON gamagronomist."DemoPlotDetail"("demoPlotId");

-- ── Stock Opname ────────────────────────────────────
CREATE INDEX IF NOT EXISTS "StockOpname_userId_status_idx"
    ON gamagronomist."StockOpname"("userId", "status");
CREATE INDEX IF NOT EXISTS "OpnameDetail_opnameId_idx"
    ON gamagronomist."OpnameDetail"("opnameId");

-- ── Laporan aktivitas ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS "CustomerBehavior_userId_createdAt_idx"
    ON gamagronomist."CustomerBehavior"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerBehavior_snapshotAreaId_createdAt_idx"
    ON gamagronomist."CustomerBehavior"("snapshotAreaId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerBehavior_createdAt_idx"
    ON gamagronomist."CustomerBehavior"("createdAt");

CREATE INDEX IF NOT EXISTS "VisitKios_userId_createdAt_idx"
    ON gamagronomist."VisitKios"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VisitKios_snapshotAreaId_createdAt_idx"
    ON gamagronomist."VisitKios"("snapshotAreaId", "createdAt");

CREATE INDEX IF NOT EXISTS "FarmerGathering_userId_createdAt_idx"
    ON gamagronomist."FarmerGathering"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "FarmerGathering_snapshotAreaId_createdAt_idx"
    ON gamagronomist."FarmerGathering"("snapshotAreaId", "createdAt");

CREATE INDEX IF NOT EXISTS "VisitCompany_userId_createdAt_idx"
    ON gamagronomist."VisitCompany"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VisitCompany_snapshotAreaId_createdAt_idx"
    ON gamagronomist."VisitCompany"("snapshotAreaId", "createdAt");

CREATE INDEX IF NOT EXISTS "SpotDemplot_userId_date_idx"
    ON gamagronomist."SpotDemplot"("userId", "date");
CREATE INDEX IF NOT EXISTS "SpotDemplot_snapshotAreaId_date_idx"
    ON gamagronomist."SpotDemplot"("snapshotAreaId", "date");
CREATE INDEX IF NOT EXISTS "SpotDemplot_createdAt_idx"
    ON gamagronomist."SpotDemplot"("createdAt");
CREATE INDEX IF NOT EXISTS "SpotDemplotDetail_spotDemplotId_idx"
    ON gamagronomist."SpotDemplotDetail"("spotDemplotId");

CREATE INDEX IF NOT EXISTS "ContentVideo_userId_createdAt_idx"
    ON gamagronomist."ContentVideo"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentVideo_snapshotAreaId_createdAt_idx"
    ON gamagronomist."ContentVideo"("snapshotAreaId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentVideoProduct_contentVideoId_idx"
    ON gamagronomist."ContentVideoProduct"("contentVideoId");

-- ── Notification ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
    ON gamagronomist."Notification"("userId", "createdAt");

-- ── Statistik planner ──────────────────────────────────────
ANALYZE gamagronomist."Ledger";
ANALYZE gamagronomist."Request";
ANALYZE gamagronomist."Notification";
ANALYZE gamagronomist."DemoPlot";
ANALYZE gamagronomist."CustomerBehavior";

-- ── Verifikasi: index INVALID (harus 0 baris) ───────────────
-- SELECT c.relname AS index_name
--   FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'gamagronomist' AND NOT i.indisvalid;

-- ── Contoh cek efek (harus Index Scan, bukan Seq Scan) ──────
-- EXPLAIN ANALYZE SELECT * FROM gamagronomist."Notification"
--  WHERE "userId" = '<id>' ORDER BY "createdAt" DESC LIMIT 20;
