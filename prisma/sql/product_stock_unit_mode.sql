-- ============================================================
-- Satuan stok produk: GRAMASI | KEMASAN | NULL (belum ditentukan)
-- Schema: gamagronomist
--
-- Produk dengan satuan stok belum ditentukan TIDAK bisa menerima stok masuk
-- (approval FO, penerimaan SPV, Gudang Sampel, input manual, penyesuaian)
-- sampai admin mengisi isi per kemasan atau memilih "Kemasan utuh".
--
-- Jalankan SEBELUM deploy kode yang memakai kolom ini (langkah 1),
-- cek hasil pratinjau (langkah 2), lalu isi data lama (langkah 3).
-- Script ini idempotent (aman dijalankan berulang).
-- ============================================================

-- 1. Kolom baru
ALTER TABLE gamagronomist."Product" ADD COLUMN IF NOT EXISTS "stockUnitMode" TEXT;

-- 2. PRATINJAU (hanya baca): status yang akan diberikan ke produk lama
--    GRAMASI       : isi per kemasan sudah terisi
--    KEMASAN       : tanpa gramasi, sudah punya transaksi, dan namanya TIDAK menyebut isi
--    (tetap NULL)  : tanpa gramasi tapi nama menyebut isi (mis. "500 ml") → admin harus putuskan
--                    tanpa gramasi dan belum pernah dipakai → diputuskan saat pertama diajukan
WITH used AS (
  SELECT "productId" FROM gamagronomist."Ledger"
  UNION SELECT "productId" FROM gamagronomist."RequestDetail"
  UNION SELECT "productId" FROM gamagronomist."SampleLedger"
)
SELECT
  CASE
    WHEN p."unitGramasi" IS NOT NULL AND p."gramasiPerUnit" > 0 THEN 'GRAMASI'
    WHEN p.id IN (SELECT "productId" FROM used)
         AND p.name !~* '\d+([.,]\d+)?\s*(ml|cc|lt|liter|l|gram|gr|g|kg)([^a-z]|$)' THEN 'KEMASAN'
    ELSE NULL
  END AS akan_menjadi,
  p.id IN (SELECT "productId" FROM used) AS pernah_dipakai,
  p.name, COALESCE(p.code, p."accurateId") AS sku, p.unit, p."unitGramasi", p."gramasiPerUnit"
FROM gamagronomist."Product" p
WHERE p."stockUnitMode" IS NULL
ORDER BY akan_menjadi NULLS FIRST, pernah_dipakai DESC, p.name;

-- 3. Isi data lama (hanya baris yang masih NULL; keputusan admin tidak ditimpa)
UPDATE gamagronomist."Product"
SET "stockUnitMode" = 'GRAMASI'
WHERE "stockUnitMode" IS NULL AND "unitGramasi" IS NOT NULL AND "gramasiPerUnit" > 0;

WITH used AS (
  SELECT "productId" FROM gamagronomist."Ledger"
  UNION SELECT "productId" FROM gamagronomist."RequestDetail"
  UNION SELECT "productId" FROM gamagronomist."SampleLedger"
)
UPDATE gamagronomist."Product" p
SET "stockUnitMode" = 'KEMASAN'
WHERE p."stockUnitMode" IS NULL
  AND NOT (p."unitGramasi" IS NOT NULL AND p."gramasiPerUnit" > 0)
  AND p.id IN (SELECT "productId" FROM used)
  AND p.name !~* '\d+([.,]\d+)?\s*(ml|cc|lt|liter|l|gram|gr|g|kg)([^a-z]|$)';
