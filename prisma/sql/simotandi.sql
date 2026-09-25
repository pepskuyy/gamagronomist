-- ============================================================
-- Tabel SIMOTANDI (fase tanam padi)
-- Schema: gamagronomist
--
-- Jalankan di Supabase Studio → SQL Editor.
-- Script ini idempotent (aman dijalankan berulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS gamagronomist."SimotandiPeriode" (
    "id"        INTEGER NOT NULL,
    "kode"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate"   TIMESTAMP(3),
    "syncedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimotandiPeriode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS gamagronomist."SimotandiWilayah" (
    "id"             TEXT NOT NULL,
    "periodeId"      INTEGER NOT NULL,
    "level"          TEXT NOT NULL,
    "nama"           TEXT NOT NULL,
    "kdpr"           TEXT NOT NULL,
    "kdkb"           TEXT,
    "kdkc"           TEXT,
    "bera"           DOUBLE PRECISION NOT NULL,
    "penyiapanLahan" DOUBLE PRECISION NOT NULL,
    "tanam"          DOUBLE PRECISION NOT NULL,
    "veg1"           DOUBLE PRECISION NOT NULL,
    "veg2"           DOUBLE PRECISION NOT NULL,
    "gen1"           DOUBLE PRECISION NOT NULL,
    "gen2"           DOUBLE PRECISION NOT NULL,
    "panen"          DOUBLE PRECISION NOT NULL,
    "standingCrop"   DOUBLE PRECISION NOT NULL,
    "lsb"            DOUBLE PRECISION NOT NULL,
    CONSTRAINT "SimotandiWilayah_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimotandiPeriode_kode_idx"
    ON gamagronomist."SimotandiPeriode"("kode");

CREATE INDEX IF NOT EXISTS "SimotandiWilayah_periodeId_level_idx"
    ON gamagronomist."SimotandiWilayah"("periodeId", "level");

CREATE INDEX IF NOT EXISTS "SimotandiWilayah_kdkb_idx"
    ON gamagronomist."SimotandiWilayah"("kdkb");

CREATE INDEX IF NOT EXISTS "SimotandiWilayah_kdkc_idx"
    ON gamagronomist."SimotandiWilayah"("kdkc");

CREATE UNIQUE INDEX IF NOT EXISTS "SimotandiWilayah_periodeId_level_kdkb_kdkc_key"
    ON gamagronomist."SimotandiWilayah"("periodeId", "level", "kdkb", "kdkc");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SimotandiWilayah_periodeId_fkey'
    ) THEN
        ALTER TABLE gamagronomist."SimotandiWilayah"
            ADD CONSTRAINT "SimotandiWilayah_periodeId_fkey"
            FOREIGN KEY ("periodeId") REFERENCES gamagronomist."SimotandiPeriode"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
