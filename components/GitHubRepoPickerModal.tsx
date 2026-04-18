'use client'

import { useEffect, useState } from 'react'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
  permissions?: { admin: boolean; push: boolean; pull: boolean }
}

interface GitHubRepoPickerModalProps {
  onClose: () => void
  onSelectRepo: (url: string, name: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
}

export default function GitHubRepoPickerModal({ onClose, onSelectRepo }: GitHubRepoPickerModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'collab'>('all')
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/github/repos')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setRepos(data.repos ?? [])
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to fetch repositories')
        setLoading(false)
      })
  }, [])

  const q = search.toLowerCase()
  const filtered = repos.filter((r) => {
    const matchesSearch = !q || r.full_name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
    if (filter === 'owned') return matchesSearch && r.permissions?.admin
    if (filter === 'collab') return matchesSearch && !r.permissions?.admin
    return matchesSearch
  })

  function handleAnalyze(repo: GitHubRepo) {
    setAdding(repo.full_name)
    onSelectRepo(repo.html_url, repo.name)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border expand-in"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#161b22', border: '1px solid #30363d' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>My GitHub Repositories</h2>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              {loading ? 'Fetching…' : `${repos.length} repos accessible with your account`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--fg-muted)', background: 'var(--bg-surface)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="px-5 py-3 border-b flex gap-2 items-center" style={{ borderColor: 'var(--border)' }}>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--fg-muted)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos…"
              autoFocus
              className="w-full pl-8 pr-3 h-9 text-sm rounded-xl outline-none transition-all"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['all', 'owned', 'collab'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: filter === f ? 'var(--brand-gradient)' : 'var(--bg-surface)',
                  color: filter === f ? 'white' : 'var(--fg-muted)',
                }}
              >
                {f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Collaborator'}
              </button>
            ))}
          </div>
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {/* Unique loader: waveform */}
              <div className="flex items-end gap-1 h-8">
                {[20, 12, 28, 16, 24, 10, 22].map((h, i) => (
                  <span key={i} className="wave-bar" style={{ height: `${h}px`, background: 'var(--brand-gradient)' }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Fetching your repositories…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--error-bg)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Could not load repositories</p>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>{error}</p>
              </div>
              {error.includes('Sign in with GitHub') && (
                <p className="text-xs px-4 py-2 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
                  You need to be signed in with GitHub OAuth to access this feature.
                </p>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                {search ? `No repos matching "${search}"` : 'No repositories found'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all group"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-muted)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-muted)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--fg)' }}>
                        {repo.full_name}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md shrink-0 font-medium"
                        style={{
                          background: repo.private ? 'var(--bg-elevated)' : 'var(--success-bg)',
                          color: repo.private ? 'var(--fg-muted)' : 'var(--success)',
                          border: `1px solid ${repo.private ? 'var(--border)' : 'rgba(34,197,94,0.2)'}`,
                        }}
                      >
                        {repo.private ? 'private' : 'public'}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-xs mb-2 line-clamp-1" style={{ color: 'var(--fg-muted)' }}>
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      {repo.language && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: LANG_COLORS[repo.language] ?? 'var(--fg-subtle)' }}
                          />
                          {repo.language}
                        </span>
                      )}
                      {repo.stargazers_count > 0 && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          {repo.stargazers_count.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                        {timeAgo(repo.updated_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAnalyze(repo)}
                    disabled={adding === repo.full_name}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all btn-glow"
                    style={{
                      background: adding === repo.full_name ? 'var(--bg-elevated)' : 'var(--brand-gradient)',
                      color: adding === repo.full_name ? 'var(--fg-muted)' : 'white',
                      border: 'none',
                      cursor: adding === repo.full_name ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {adding === repo.full_name ? 'Adding…' : 'Analyze'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && filtered.length > 0 && (
          <div className="px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--fg-subtle)' }}>
            Showing {filtered.length} of {repos.length} repos · Private repos are fully supported
          </div>
        )}
      </div>
    </div>
  )
}
