-- ============================================================
-- Tabel Analitik Dampak Penjualan Demoplot (Sales Dashboard Sync)
-- Schema: gamagronomist
--
-- Jalankan di Supabase Studio → SQL Editor.
-- Script ini idempotent (aman dijalankan berulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS gamagronomist."dashboard_customers" (
    "id"               TEXT NOT NULL,
    "accurate_id"      TEXT,
    "customer_no"      TEXT,
    "name"             TEXT NOT NULL,
    "city"             TEXT,
    "region"           TEXT,
    "default_salesman" TEXT,
    "latitude"         DOUBLE PRECISION,
    "longitude"        DOUBLE PRECISION,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS gamagronomist."dashboard_invoices" (
    "id_invoice"       TEXT NOT NULL,
    "customer_id"      TEXT,
    "nama_toko"        TEXT,
    "nama_sales"       TEXT,
    "tanggal"          TIMESTAMP(3) NOT NULL,
    "status"           TEXT,
    "omset"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "items"            JSONB NOT NULL DEFAULT '[]'::jsonb,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_invoices_pkey" PRIMARY KEY ("id_invoice")
);

CREATE INDEX IF NOT EXISTS "dashboard_customers_name_idx"
    ON gamagronomist."dashboard_customers"("name");

CREATE INDEX IF NOT EXISTS "dashboard_invoices_customer_id_idx"
    ON gamagronomist."dashboard_invoices"("customer_id");

CREATE INDEX IF NOT EXISTS "dashboard_invoices_nama_toko_idx"
    ON gamagronomist."dashboard_invoices"("nama_toko");

CREATE INDEX IF NOT EXISTS "dashboard_invoices_tanggal_idx"
    ON gamagronomist."dashboard_invoices"("tanggal");

-- Alihkan kepemilikan ke role aplikasi 'postgres' agar tidak permission denied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        ALTER TABLE gamagronomist."dashboard_customers" OWNER TO postgres;
        ALTER TABLE gamagronomist."dashboard_invoices" OWNER TO postgres;
    END IF;
END $$;
