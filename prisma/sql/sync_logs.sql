-- ============================================================
-- Tabel Monitoring & Audit Log Sinkronisasi Data
-- Schema: gamagronomist
--
-- Jalankan di Supabase Studio → SQL Editor.
-- Script ini idempotent (aman dijalankan berulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS gamagronomist."sync_logs" (
    "id"              TEXT NOT NULL,
    "data_type"       TEXT NOT NULL,
    "trigger_type"    TEXT NOT NULL DEFAULT 'MANUAL',
    "status"          TEXT NOT NULL,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "message"         TEXT,
    "error_detail"    TEXT,
    "duration_ms"     INTEGER,
    "started_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_logs_data_type_idx"
    ON gamagronomist."sync_logs"("data_type");

CREATE INDEX IF NOT EXISTS "sync_logs_status_idx"
    ON gamagronomist."sync_logs"("status");

CREATE INDEX IF NOT EXISTS "sync_logs_started_at_idx"
    ON gamagronomist."sync_logs"("started_at");

-- Alihkan kepemilikan ke role aplikasi 'postgres' agar tidak permission denied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        ALTER TABLE gamagronomist."sync_logs" OWNER TO postgres;
    END IF;
END $$;
