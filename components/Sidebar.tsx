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
  onAddRepo: () => void
  onGoHome: () => void
  onMultiRepoChat: (repoIds: number[], repoNames: string[]) => void
  username: string
}

export default function Sidebar({ activeRepoId, onSelectRepo, onRestoreSession, onAddRepo, onGoHome, onMultiRepoChat, username }: SidebarProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [search, setSearch] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [addingRepo, setAddingRepo] = useState(false)
  const [addError, setAddError] = useState('')
  const [compareMode, setCompareMode] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set())

  function toggleRepoSelection(id: number) {
    setSelectedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startMultiRepoChat() {
    const ids = Array.from(selectedRepos)
    const names = ids.map((id) => repos.find((r) => r.id === id)?.name ?? 'repo')
    onMultiRepoChat(ids, names)
    setCompareMode(false)
    setSelectedRepos(new Set())
  }

  async function handleAddRepo() {
    if (!newRepoUrl.trim() || addingRepo) return
    setAddingRepo(true)
    setAddError('')

    // Normalize the URL
    let url = newRepoUrl.trim()
    if (!url.startsWith('http')) url = `https://${url}`

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const text = await res.text()
        setAddError(text || 'Failed to start indexing')
        setAddingRepo(false)
        return
      }

      // Parse SSE stream for completion
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.stage === 'done' && data.repoId) {
                const name = url.split('/').at(-1)?.replace('.git', '') ?? 'repo'
                setShowAddInput(false)
                setNewRepoUrl('')
                setAddingRepo(false)
                fetchRepos()
                onAddRepo()
                onSelectRepo(data.repoId, name)
                return
              }
              if (data.stage === 'error') {
                setAddError(data.error || 'Indexing failed')
                setAddingRepo(false)
                return
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Network error')
    }
    setAddingRepo(false)
  }

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
      {/* Logo — click to go home */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 w-full text-left transition-opacity hover:opacity-80"
          title="Go to home page"
        >
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
        </button>
      </div>

      {/* Repos list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            INDEXED REPOS
          </p>
          <div className="flex items-center gap-1">
            {ready.length >= 2 && (
              <button
                onClick={() => { setCompareMode(!compareMode); setSelectedRepos(new Set()) }}
                className="text-xs px-2 py-0.5 rounded transition-colors"
                style={{
                  background: compareMode ? '#dc2626' : '#1e1e3a',
                  color: 'white',
                  border: `1px solid ${compareMode ? '#dc2626' : 'var(--border)'}`,
                }}
                title={compareMode ? 'Cancel compare' : 'Compare repos'}
              >
                {compareMode ? 'Cancel' : 'Compare'}
              </button>
            )}
            <button
              onClick={() => { setShowAddInput(!showAddInput); setAddError('') }}
              className="text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
              }}
              title="Add new repo"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Compare mode banner */}
        {compareMode && (
          <div className="mb-2 px-2">
            <p className="text-xs text-indigo-300 mb-1">Select 2+ repos to compare:</p>
            {selectedRepos.size >= 2 && (
              <button
                onClick={startMultiRepoChat}
                className="w-full text-xs py-1.5 rounded-lg font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                }}
              >
                Chat with {selectedRepos.size} repos
              </button>
            )}
          </div>
        )}

        {/* Inline add repo form */}
        {showAddInput && (
          <div className="mb-2 px-1">
            <div className="flex gap-1">
              <input
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRepo()
                  if (e.key === 'Escape') { setShowAddInput(false); setNewRepoUrl('') }
                }}
                placeholder="github.com/owner/repo"
                disabled={addingRepo}
                autoFocus
                className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg outline-none"
                style={{
                  background: '#0a0a0f',
                  border: '1px solid var(--border)',
                  color: 'white',
                }}
              />
              <button
                onClick={handleAddRepo}
                disabled={addingRepo || !newRepoUrl.trim()}
                className="shrink-0 px-2 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: addingRepo ? '#2d2d44' : '#6366f1',
                  color: 'white',
                }}
              >
                {addingRepo ? '...' : 'Go'}
              </button>
            </div>
            {addError && (
              <p className="text-xs text-red-400 mt-1 px-1">{addError}</p>
            )}
          </div>
        )}
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
            onClick={() => compareMode ? toggleRepoSelection(r.id) : onSelectRepo(r.id, r.name)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
            style={{
              background: compareMode
                ? selectedRepos.has(r.id) ? '#1e1b4b' : 'transparent'
                : activeRepoId === r.id ? '#1e1e3a' : 'transparent',
              border: compareMode
                ? selectedRepos.has(r.id) ? '1px solid #6366f1' : '1px solid transparent'
                : activeRepoId === r.id ? '1px solid #3730a3' : '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (!compareMode && activeRepoId !== r.id) e.currentTarget.style.background = 'var(--muted)'
              if (compareMode && !selectedRepos.has(r.id)) e.currentTarget.style.background = 'var(--muted)'
            }}
            onMouseLeave={(e) => {
              if (!compareMode && activeRepoId !== r.id) e.currentTarget.style.background = 'transparent'
              if (compareMode && !selectedRepos.has(r.id)) e.currentTarget.style.background = 'transparent'
            }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {compareMode ? (
                <span
                  className="w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0"
                  style={{
                    borderColor: selectedRepos.has(r.id) ? '#6366f1' : 'var(--border)',
                    background: selectedRepos.has(r.id) ? '#6366f1' : 'transparent',
                    color: 'white',
                  }}
                >
                  {selectedRepos.has(r.id) ? '✓' : ''}
                </span>
              ) : (
                <span className="text-xs">📁</span>
              )}
              <span className="text-xs font-medium text-white truncate">{r.name}</span>
            </div>
            <p className="text-xs ml-5 truncate" style={{ color: 'var(--muted-foreground)' }}>
              {r.owner} · {r.fileCount ?? 0} files · {r.commitCount ?? 0} commits
            </p>
            {!compareMode && (
              <div className="ml-5 mt-1 flex items-center gap-2">
                <ReIngestButton repoId={r.id} onDone={fetchRepos} />
                <DeleteRepoButton repoId={r.id} repoName={r.name} onDeleted={fetchRepos} />
              </div>
            )}
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
