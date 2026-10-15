-- ============================================================
-- Tabel Daftar Produk Fokus / Pengembangan (Analitik Demplot)
-- Schema: gamagronomist
--
-- Jalankan di Supabase Studio → SQL Editor.
-- Script ini idempotent (aman dijalankan berulang).
--
-- Data lama (JSON di SystemConfig key 'demoplot_development_products')
-- dipindahkan otomatis oleh aplikasi saat daftar pertama kali dibuka,
-- lalu key lama di-rename menjadi 'demoplot_development_products__migrated'
-- sebagai cadangan.
-- ============================================================

CREATE TABLE IF NOT EXISTS gamagronomist."development_products" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "name_key"      TEXT NOT NULL,
    "code"          TEXT,
    "target_crop"   TEXT,
    "notes"         TEXT,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "development_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "development_products_name_key_key"
    ON gamagronomist."development_products"("name_key");

CREATE INDEX IF NOT EXISTS "development_products_is_active_idx"
    ON gamagronomist."development_products"("is_active");

-- Alihkan kepemilikan ke role aplikasi 'postgres' agar tidak permission denied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        ALTER TABLE gamagronomist."development_products" OWNER TO postgres;
    END IF;
END $$;
