'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import ReIngestButton from './ReIngestButton'
import ChatHistory from './ChatHistory'
import DeleteRepoButton from './DeleteRepoButton'

interface Repo {
  id: number
  url: string
  name: string
  owner: string
  status: string
  fileCount: number | null
  commitCount: number | null
}

interface SidebarProps {
  activeRepoId: number | null
  onSelectRepo: (id: number, name: string) => void
  onRestoreSession: (sessionId: number, repoId: number, repoName: string) => void
  username: string
}

export default function Sidebar({ activeRepoId, onSelectRepo, onRestoreSession, username }: SidebarProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [search, setSearch] = useState('')

  async function fetchRepos() {
    const res = await fetch('/api/repos')
    if (res.ok) {
      const data = await res.json()
      setRepos(data.repos)
    }
  }

  useEffect(() => {
    fetchRepos()
    const interval = setInterval(fetchRepos, 8000)
    return () => clearInterval(interval)
  }, [])

  // Expose refresh for parent
  useEffect(() => {
    const handler = () => fetchRepos()
    window.addEventListener('repomind:refresh-repos', handler)
    return () => window.removeEventListener('repomind:refresh-repos', handler)
  }, [])

  const q = search.toLowerCase()
  const ready = repos.filter(
    (r) => r.status === 'ready' && (
      !q || r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)
    )
  )
  const processing = repos.filter((r) => r.status === 'processing' || r.status === 'pending')

  return (
    <div
      className="w-64 h-full flex flex-col border-r"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            🔍
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">RepoMind</h1>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Code Archaeologist
            </p>
          </div>
        </div>
      </div>

      {/* Repos list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-medium px-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>
          INDEXED REPOS
        </p>
        {repos.filter(r => r.status === 'ready').length > 2 && (
          <div className="relative mb-2">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs">🔎</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter repos…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none"
              style={{
                background: '#0a0a0f',
                border: '1px solid var(--border)',
                color: 'white',
              }}
            />
          </div>
        )}

        {ready.length === 0 && processing.length === 0 && (
          <p className="text-xs px-2 text-slate-600">
            No repos yet. Paste a URL to get started.
          </p>
        )}

        {/* Processing repos */}
        {processing.map((r) => (
          <div
            key={r.id}
            className="w-full text-left px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--muted)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs text-slate-400 truncate">{r.name}</span>
            </div>
            <p className="text-xs ml-3.5" style={{ color: 'var(--muted-foreground)' }}>
              Indexing…
            </p>
          </div>
        ))}

        {/* Ready repos */}
        {ready.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRepo(r.id, r.name)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
            style={{
              background: activeRepoId === r.id ? '#1e1e3a' : 'transparent',
              border: activeRepoId === r.id ? '1px solid #3730a3' : '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (activeRepoId !== r.id) e.currentTarget.style.background = 'var(--muted)'
            }}
            onMouseLeave={(e) => {
              if (activeRepoId !== r.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs">📁</span>
              <span className="text-xs font-medium text-white truncate">{r.name}</span>
            </div>
            <p className="text-xs ml-5 truncate" style={{ color: 'var(--muted-foreground)' }}>
              {r.owner} · {r.fileCount ?? 0} files · {r.commitCount ?? 0} commits
            </p>
            <div className="ml-5 mt-1 flex items-center gap-2">
              <ReIngestButton repoId={r.id} onDone={fetchRepos} />
              <DeleteRepoButton repoId={r.id} repoName={r.name} onDeleted={fetchRepos} />
            </div>
          </button>
        ))}
      </div>

      {/* Chat history */}
      <ChatHistory onRestoreSession={onRestoreSession} />

      {/* User footer */}
      <div
        className="px-3 py-3 border-t flex items-center gap-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {username[0]?.toUpperCase()}
        </div>
        <span className="text-xs text-slate-300 flex-1 truncate">{username}</span>
        <button
          onClick={() => signOut()}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          title="Sign out"
        >
          ⎋
        </button>
      </div>
    </div>
  )
}
