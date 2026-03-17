import { PrismaClient } from '@prisma/client'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function UsersMasterPage() {
  const users = await prisma.user.findMany({
    include: {
      area: true,
      afa: true // Untuk FO melihat AFA supervisornya
    },
    orderBy: { role: 'asc' }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Master Data: Pengguna</h2>
        <button className="btn btn-primary">➕ Tambah User</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--surface-hover)', borderBottom: '2px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Nama</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Username</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Area</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Supervisor AFA</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}>{user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{user.username}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${
                      user.role === 'ADMIN' ? 'badge-danger' : 
                      user.role === 'SPV' ? 'badge-warning' : 
                      user.role === 'AFA' ? 'badge-success' : 'badge-neutral'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{user.area?.name || '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{user.afa?.name || '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={{ color: 'var(--secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Data pengguna kosong
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
