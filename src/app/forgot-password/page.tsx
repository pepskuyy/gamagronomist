'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetPasswordWithEmail } from '../actions/auth'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'verify' | 'reset' | 'done'>('verify')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    
    start(async () => {
      const res = await resetPasswordWithEmail(fd)
      if (res?.error) {
        setError(res.error)
      } else {
        setStep('done')
      }
    })
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">🌱 Agrolens</div>
          <p>Reset Password</p>
        </div>

        {step === 'done' ? (
          <div>
            <div style={{ background: '#dcfce7', color: '#166534', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <strong>Password berhasil direset!</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                Silakan masuk dengan password baru Anda.
              </p>
            </div>
            <button 
              onClick={() => router.push('/login')}
              className="btn btn-primary btn-block"
            >
              ← Kembali ke Login
            </button>
          </div>
        ) : (
          <>
            {/* Info */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#1e40af' }}>
              <strong>Cara Reset:</strong> Masukkan username dan email yang terdaftar pada akun Anda, lalu buat password baru.
            </div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  name="username" 
                  type="text" 
                  className="form-control" 
                  required 
                  placeholder="Masukkan username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Terdaftar</label>
                <input 
                  name="email" 
                  type="email" 
                  className="form-control" 
                  required 
                  placeholder="Email yang didaftarkan di pengaturan akun"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '1.25rem 0' }} />

              <div className="form-group">
                <label className="form-label">Password Baru</label>
                <input 
                  name="newPassword" 
                  type="password" 
                  className="form-control" 
                  required 
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Konfirmasi Password Baru</label>
                <input 
                  name="confirmPassword" 
                  type="password" 
                  className="form-control" 
                  required 
                  minLength={6}
                  placeholder="Ketik ulang password baru"
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block" 
                disabled={isPending}
              >
                {isPending ? 'Memproses...' : '🔓 Reset Password'}
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <a href="/login" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
                ← Kembali ke halaman login
              </a>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          padding: 1.5rem;
        }
        .login-card {
          background: var(--surface);
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          padding: 2.5rem;
          width: 100%;
          max-width: 420px;
          animation: slideUp 0.4s ease-out;
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .logo {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 0.5rem;
        }
        .login-header p {
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .btn-block {
          width: 100%;
          margin-top: 1rem;
          padding: 0.875rem;
          font-size: 1rem;
        }
        .alert-error {
          background-color: var(--danger);
          color: white;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          text-align: center;
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
