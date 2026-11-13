-- ============================================================
-- Transfer stok antar AFA (pengajuan → approval SPV → konfirmasi terima)
-- Schema: gamagronomist
--
-- Jalankan SEBELUM deploy kode yang memakai tabel ini.
-- Script ini idempotent (aman dijalankan berulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS gamagronomist."StockTransfer" (
    "id"           TEXT NOT NULL,
    "fromUserId"   TEXT NOT NULL,
    "toUserId"     TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'SUBMITTED',
    "notes"        TEXT,
    "approvedById" TEXT,
    "rejectReason" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"   TIMESTAMP(3),
    "receivedAt"   TIMESTAMP(3),
    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS gamagronomist."StockTransferItem" (
    "id"           TEXT NOT NULL,
    "transferId"   TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "qtyRequested" DOUBLE PRECISION NOT NULL,
    "qtyApproved"  DOUBLE PRECISION,
    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockTransfer_fromUserId_status_idx" ON gamagronomist."StockTransfer"("fromUserId", "status");
CREATE INDEX IF NOT EXISTS "StockTransfer_toUserId_status_idx"   ON gamagronomist."StockTransfer"("toUserId", "status");
CREATE INDEX IF NOT EXISTS "StockTransferItem_transferId_idx"    ON gamagronomist."StockTransferItem"("transferId");

DO $$ BEGIN
  ALTER TABLE gamagronomist."StockTransfer" ADD CONSTRAINT "StockTransfer_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES gamagronomist."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gamagronomist."StockTransfer" ADD CONSTRAINT "StockTransfer_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES gamagronomist."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gamagronomist."StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES gamagronomist."StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gamagronomist."StockTransferItem" ADD CONSTRAINT "StockTransferItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES gamagronomist."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
