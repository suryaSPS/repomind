'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { username, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid username or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  function handleGitHubSignIn() {
    setGithubLoading(true)
    signIn('github', { callbackUrl: '/' })
  }

  function handleGoogleSignIn() {
    setGoogleLoading(true)
    signIn('google', { callbackUrl: '/' })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm expand-in">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>RepoMind</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>Code Archaeologist</p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6 border"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg-secondary)' }}>Sign in to your account</p>

          {/* GitHub */}
          <button
            onClick={handleGitHubSignIn}
            disabled={githubLoading}
            className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg font-medium text-sm mb-2.5 border transition-all"
            style={{
              background: githubLoading ? 'var(--bg-surface)' : '#161b22',
              color: 'white',
              borderColor: '#30363d',
            }}
          >
            {githubLoading ? <Spinner color="white" /> : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </>
            )}
          </button>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg font-medium text-sm mb-5 border transition-all"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--fg)',
              borderColor: 'var(--border)',
            }}
          >
            {googleLoading ? <Spinner color="var(--fg-muted)" /> : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>or continue with username</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="your-username"
                autoComplete="username"
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: `1px solid ${focusedField === 'username' ? 'var(--brand)' : 'var(--border)'}`,
                  color: 'var(--fg)',
                  boxShadow: focusedField === 'username' ? '0 0 0 3px var(--brand-glow-sm)' : 'none',
                }}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: `1px solid ${focusedField === 'password' ? 'var(--brand)' : 'var(--border)'}`,
                  color: 'var(--fg)',
                  boxShadow: focusedField === 'password' ? '0 0 0 3px var(--brand-glow-sm)' : 'none',
                }}
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--error-bg)', border: '1px solid rgba(248,113,113,0.18)', color: 'var(--error)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg font-medium text-sm text-white transition-opacity"
              style={{
                background: loading ? 'var(--bg-elevated)' : 'var(--brand)',
                color: loading ? 'var(--fg-muted)' : 'white',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner color="var(--fg-muted)" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--fg-subtle)' }}>
          Your indexed repos are private to your account
        </p>
      </div>
    </div>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="9" y="2" width="2" height="5" rx="1" fill={color} opacity={0.15 + i * 0.11} transform={`rotate(${i * 45} 10 10)`} />
      ))}
    </svg>
  )
}
