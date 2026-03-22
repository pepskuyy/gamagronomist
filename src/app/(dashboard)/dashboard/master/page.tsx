import Link from 'next/link'

export default function MasterDataIndex() {
  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Master Data</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <Link href="/dashboard/master/users" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Pengguna (AFA/FO)</h3>
            <p style={{ fontSize: '0.9rem' }}>Kelola data supervisor (SPV), assisten lapangan (AFA), dan field officer (FO).</p>
          </div>
        </Link>
        
        <Link href="/dashboard/master/products" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧪</div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Produk</h3>
            <p style={{ fontSize: '0.9rem' }}>Kelola master data produk pertanian, satuan unit (ml, gr), dan deskripsi lengkap.</p>
          </div>
        </Link>
        
        <Link href="/dashboard/master/areas" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🗺️</div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Area &amp; Petani</h3>
            <p style={{ fontSize: '0.9rem' }}>Kelola data wilayah operasional dan kontak petani.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/requests" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', height: '100%', borderColor: '#fde68a' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <h3 style={{ marginBottom: '0.5rem', color: '#b45309' }}>Permintaan Akun</h3>
            <p style={{ fontSize: '0.9rem' }}>Tinjau dan setujui permintaan pembuatan akun dari calon pengguna.</p>
          </div>
        </Link>

        <Link href="/dashboard/master/import" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', height: '100%', borderColor: '#93c5fd', background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
            <h3 style={{ marginBottom: '0.5rem', color: '#1d4ed8' }}>Migrasi Data (Import)</h3>
            <p style={{ fontSize: '0.9rem' }}>Import data dari spreadsheet: Area, User, Petani, Customer Behavior, dan Demo Plot.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
