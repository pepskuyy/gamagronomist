import Link from 'next/link'
import { Users, FlaskConical, Map, ClipboardList, Package, Store } from 'lucide-react'

const cardStyle = { cursor: 'pointer', height: '100%' } as const
const iconStyle = { color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' } as const
const titleStyle = { marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600 } as const
const descStyle = { fontSize: '0.875rem', color: 'var(--text-muted)' } as const

export default function MasterDataIndex() {
  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Master Data</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <Link href="/dashboard/master/users" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <Users size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Pengguna (AFA/FO)</h3>
            <p style={descStyle}>Kelola data supervisor (SPV), assisten lapangan (AFA), dan field officer (FO).</p>
          </div>
        </Link>

        <Link href="/dashboard/master/products" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <FlaskConical size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Produk</h3>
            <p style={descStyle}>Kelola master data produk pertanian, satuan unit (ml, gr), dan deskripsi lengkap.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/areas" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <Map size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Area &amp; Petani</h3>
            <p style={descStyle}>Kelola data wilayah operasional dan kontak petani.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/requests" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <ClipboardList size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Permintaan Akun</h3>
            <p style={descStyle}>Tinjau dan setujui permintaan pembuatan akun dari calon pengguna.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/import" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <Package size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Migrasi Data (Import)</h3>
            <p style={descStyle}>Import data dari spreadsheet: Area, User, Petani, Customer Behavior, dan Demo Plot.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/stores" style={{ textDecoration: 'none' }}>
          <div className="card" style={cardStyle}>
            <Store size={20} strokeWidth={1.75} style={iconStyle} />
            <h3 style={titleStyle}>Toko / Kios</h3>
            <p style={descStyle}>Kelola master data toko pelanggan. Sinkronisasi dari Accurate Online. Koordinat GPS ditampilkan di peta sebaran.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
