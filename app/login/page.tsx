'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Invalid username or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-2xl">🔍</span>
          </div>
          <h1 className="text-2xl font-bold text-white">RepoMind</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            AI Code Archaeologist
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Enter your credentials to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                autoComplete="username"
                required
                className="w-full"
                style={{
                  background: '#0a0a0f',
                  border: '1px solid var(--border)',
                  color: 'white',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full"
                style={{
                  background: '#0a0a0f',
                  border: '1px solid var(--border)',
                  color: 'white',
                }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-medium"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                border: 'none',
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Add users via <code className="text-indigo-400">SEED_USERS</code> in <code className="text-indigo-400">.env.local</code>
        </p>
      </div>
    </div>
  )
}
