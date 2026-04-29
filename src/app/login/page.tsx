'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '../actions/auth'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const res = await login(formData)
    
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Agrolens" style={{ width: '200px', height: 'auto', objectFit: 'contain' }} />
          </div>
          <p>Sistem Tracking Stok &amp; Demo Plot</p>
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
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              name="password" 
              type="password" 
              className="form-control" 
              required 
              placeholder="Masukkan password"
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading}
          >
            {loading ? 'Sedang Masuk...' : 'Masuk'}
          </button>
        </form>

        {/* Forgot password */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <a href="/forgot-password" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none' }}>
            Lupa Password?
          </a>
        </div>

        {/* Register link */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '1.25rem' }} />
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>Belum punya akun?</p>
          <a href="/register" className="btn btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: '0.9rem', padding: '0.7rem' }}>
            Buat Akun
          </a>
        </div>
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
          max-width: 400px;
          animation: slideUp 0.4s ease-out;
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .logo {
          display: flex;
          justify-content: center;
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
