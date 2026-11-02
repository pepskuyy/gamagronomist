'use client'

import { useCallback, useEffect, useState } from 'react'

const CACHE_KEY = 'cache_stockBalance'

/**
 * Saldo stok user per produk (satuan ledger) untuk form pemakaian.
 * Diambil ulang saat tab kembali aktif dan bisa dipanggil ulang (reload) setelah submit gagal,
 * supaya angka "Tersedia" tidak usang bila stok berubah setelah halaman dibuka.
 * Cache localStorage hanya dipakai bila fetch gagal (offline).
 */
export function useStockBalance() {
  const [balance, setBalance] = useState<Record<string, number>>({})

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/stock/balance', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data: { productId: string; quantity: number }[] = await res.json()
      const map: Record<string, number> = {}
      data.forEach(s => { map[s.productId] = s.quantity })
      setBalance(map)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)) } catch {}
    } catch {
      try { const c = localStorage.getItem(CACHE_KEY); if (c) setBalance(JSON.parse(c)) } catch {}
    }
  }, [])

  useEffect(() => {
    reload()
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return { balance, reload }
}
