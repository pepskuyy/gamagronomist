// Normalisasi nama produk — aman dipakai di client maupun server (tanpa prisma).
// Sama dengan norm() di lib/demoplot-impact.ts yang dipakai untuk mencocokkan invoice.
export function normalizeProductName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
