import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import UpdateEmailForm from '@/components/UpdateEmailForm'
import UpdatePhoneForm from '@/components/UpdatePhoneForm'
import UpdateProfilePhotoForm from '@/components/UpdateProfilePhotoForm'
import WahaSettingsClient from './WahaSettingsClient'


export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (!session?.userId) return <div>Unauthorized</div>

  // Fetch current email & phone from DB
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, phone: true, photo: true }
  })

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>⚙️ Pengaturan Akun</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Kelola pengaturan pribadi untuk akun <strong>{session.name}</strong> ({session.role})
      </p>

      {/* Profil Avatar Section */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.4rem' }}>📷 Foto Profil</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Gunakan foto diri yang jelas agar mudah dikenali oleh tim lain.
        </p>
        <UpdateProfilePhotoForm currentPhoto={user?.photo ?? null} />
      </div>

      {/* WhatsApp Phone Section */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.4rem' }}>📱 Nomor WhatsApp</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Daftarkan nomor WhatsApp Anda agar dapat menerima notifikasi sistem (pengajuan stok, approval, dll) via WhatsApp.
          {!user?.phone && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--warning, #d97706)', fontWeight: 600, fontSize: '0.82rem' }}>
              ⚠️ Anda belum mendaftarkan nomor WhatsApp. Notifikasi tidak akan terkirim.
            </span>
          )}
        </p>
        <UpdatePhoneForm currentPhone={user?.phone ?? null} />
      </div>

      {/* Email Recovery Section */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.4rem' }}>📧 Email Pemulihan</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Daftarkan email Anda agar dapat digunakan untuk mereset password jika lupa.
          {!user?.email && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--warning, #d97706)', fontWeight: 600, fontSize: '0.82rem' }}>
              ⚠️ Anda belum mendaftarkan email. Anda tidak bisa mereset password jika lupa.
            </span>
          )}
        </p>
        <UpdateEmailForm currentEmail={user?.email ?? null} />
      </div>

      {/* Change Password Section */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.4rem' }}>🔐 Ubah Password</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Masukkan password lama Anda terlebih dahulu untuk memverifikasi identitas, lalu ketik password baru yang diinginkan.
        </p>
        <ChangePasswordForm />
      </div>

      {/* WAHA WhatsApp Integration — Admin only */}
      {session.role === 'ADMIN' && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '2rem' }} />
          <WahaSettingsClient />
        </>
      )}
    </div>
  )
}


