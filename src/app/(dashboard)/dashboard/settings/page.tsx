import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (!session?.userId) return <div>Unauthorized</div>

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>⚙️ Pengaturan Akun</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Kelola pengaturan pribadi untuk akun <strong>{session.name}</strong> ({session.role})
      </p>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: '0.4rem' }}>🔐 Ubah Password</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Masukkan password lama Anda terlebih dahulu untuk memverifikasi identitas, lalu ketik password baru yang diinginkan.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
