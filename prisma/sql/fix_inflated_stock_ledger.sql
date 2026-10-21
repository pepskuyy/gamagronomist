-- ====================================================================
-- Script Perbaikan Entri Ledger Stok yang Menggelembung (Double Gramasi)
-- Schema: gamagronomist
--
-- Masalah: Permintaan stok FO (CMVHPM8M, CMVHPNH3, dll) yang sudah
-- dalam satuan gramasi (misal 500 ml) sempat terkalikan kembali dengan
-- gramasiPerUnit (misal 250 ml), sehingga tercatat 125.000 ml (= 500 PCS).
--
-- Query ini mengembalikan nilai quantity pada tabel Ledger tepat sama
-- dengan nilai qtyApproved pada RequestDetail (misal 500 ml).
-- ====================================================================

-- 1. Cek baris yang menggelembung sebelum diubah
SELECT 
    l.id AS ledger_id,
    l."referenceId" AS request_id,
    u.name AS user_name,
    p.name AS product_name,
    l."transactionType",
    l.quantity AS qty_sekarang,
    CASE 
        WHEN l."transactionType" = 'RECEIVE_FROM_AFA' THEN COALESCE(rd."qtyApproved", rd."qtyRequested")
        WHEN l."transactionType" = 'TRANSFER_TO_FO' THEN -COALESCE(rd."qtyApproved", rd."qtyRequested")
    END AS qty_seharusnya,
    p."gramasiPerUnit"
FROM gamagronomist."Ledger" l
JOIN gamagronomist."User" u ON l."userId" = u.id
JOIN gamagronomist."Product" p ON l."productId" = p.id
JOIN gamagronomist."RequestDetail" rd 
    ON l."referenceId" = rd."requestId" AND l."productId" = rd."productId"
WHERE l."transactionType" IN ('TRANSFER_TO_FO', 'RECEIVE_FROM_AFA')
  AND (
      l."referenceId" IN ('CMVHPM8M', 'CMVHPNH3')
      OR (
          ABS(l.quantity) > COALESCE(rd."qtyApproved", rd."qtyRequested")
          AND l."createdAt" >= '2026-10-21 00:00:00'
      )
  );

-- 2. Eksekusi koreksi quantity ledger
UPDATE gamagronomist."Ledger" l
SET quantity = CASE 
    WHEN l."transactionType" = 'RECEIVE_FROM_AFA' THEN COALESCE(rd."qtyApproved", rd."qtyRequested")
    WHEN l."transactionType" = 'TRANSFER_TO_FO' THEN -COALESCE(rd."qtyApproved", rd."qtyRequested")
    ELSE l.quantity
END
FROM gamagronomist."RequestDetail" rd
WHERE l."referenceId" = rd."requestId" 
  AND l."productId" = rd."productId"
  AND l."transactionType" IN ('TRANSFER_TO_FO', 'RECEIVE_FROM_AFA')
  AND (
      l."referenceId" IN ('CMVHPM8M', 'CMVHPNH3')
      OR (
          ABS(l.quantity) > COALESCE(rd."qtyApproved", rd."qtyRequested")
          AND l."createdAt" >= '2026-10-21 00:00:00'
      )
  );

-- 3. Verifikasi saldo akhir user
SELECT 
    u.name AS user_name,
    p.name AS product_name,
    SUM(l.quantity) AS total_ml,
    ROUND((SUM(l.quantity) / COALESCE(p."gramasiPerUnit", 1))::numeric, 1) AS total_pcs
FROM gamagronomist."Ledger" l
JOIN gamagronomist."User" u ON l."userId" = u.id
JOIN gamagronomist."Product" p ON l."productId" = p.id
WHERE u.name ILIKE '%Fither%' OR u.name ILIKE '%Zaffa%'
GROUP BY u.name, p.name, p."gramasiPerUnit"
HAVING SUM(l.quantity) > 0
ORDER BY u.name, p.name;
