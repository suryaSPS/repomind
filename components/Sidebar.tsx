'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import ReIngestButton from './ReIngestButton'
import ChatHistory from './ChatHistory'
import DeleteRepoButton from './DeleteRepoButton'
import ThemeToggle from './ThemeToggle'
import GitHubRepoPickerModal from './GitHubRepoPickerModal'

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
  const [showGitHubPicker, setShowGitHubPicker] = useState(false)

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

  async function ingestFromUrl(url: string, name: string) {
    setShowAddInput(false)
    setNewRepoUrl('')
    setAddingRepo(true)
    setAddError('')

    let fullUrl = url.trim()
    if (!fullUrl.startsWith('http')) fullUrl = `https://${fullUrl}`

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })

      if (!res.ok) {
        const text = await res.text()
        setAddError(text || 'Failed to start indexing')
        setAddingRepo(false)
        return
      }

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
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 w-full text-left transition-opacity hover:opacity-80"
          title="Go to home page"
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold" style={{ color: 'var(--fg)' }}>RepoMind</h1>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Code Archaeologist</p>
          </div>
        </button>
      </div>

      {/* Repos list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Section header */}
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-xs font-semibold tracking-widest" style={{ color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
            REPOS
          </p>
          <div className="flex items-center gap-1.5">
            {ready.length >= 2 && (
              <button
                onClick={() => { setCompareMode(!compareMode); setSelectedRepos(new Set()) }}
                className="text-xs px-2 py-0.5 rounded-lg transition-all"
                style={{
                  background: compareMode ? 'var(--error-bg)' : 'var(--bg-surface)',
                  color: compareMode ? 'var(--error)' : 'var(--fg-muted)',
                  border: `1px solid ${compareMode ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
                }}
                title={compareMode ? 'Cancel compare' : 'Compare repos'}
              >
                {compareMode ? 'Cancel' : 'Compare'}
              </button>
            )}
            {/* GitHub picker button */}
            <button
              onClick={() => setShowGitHubPicker(true)}
              className="flex items-center justify-center w-6 h-6 rounded-lg transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand)'
                e.currentTarget.style.color = 'var(--brand)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--fg-muted)'
              }}
              title="Browse my GitHub repos"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </button>
            <button
              onClick={() => { setShowAddInput(!showAddInput); setAddError('') }}
              className="text-xs px-2 py-0.5 rounded-lg transition-all font-medium"
              style={{
                background: showAddInput ? 'var(--bg-elevated)' : 'var(--brand-gradient)',
                color: 'white',
                border: '1px solid transparent',
              }}
              title="Add repo by URL"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Compare mode banner */}
        {compareMode && (
          <div className="mb-2 px-1 py-2 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-2 font-medium" style={{ color: 'var(--brand)' }}>
              Select 2+ repos to compare
            </p>
            {selectedRepos.size >= 2 && (
              <button
                onClick={startMultiRepoChat}
                className="w-full text-xs py-1.5 rounded-lg font-semibold transition-all btn-glow"
                style={{ background: 'var(--brand-gradient)', color: 'white' }}
              >
                Chat with {selectedRepos.size} repos
              </button>
            )}
          </div>
        )}

        {/* Inline add form */}
        {showAddInput && (
          <div className="mb-2 px-1">
            <div className="flex gap-1.5">
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
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <button
                onClick={handleAddRepo}
                disabled={addingRepo || !newRepoUrl.trim()}
                className="shrink-0 px-2.5 py-1.5 text-xs rounded-lg font-semibold transition-all"
                style={{
                  background: addingRepo ? 'var(--bg-elevated)' : 'var(--brand-gradient)',
                  color: 'white',
                  border: 'none',
                }}
              >
                {addingRepo ? <AddingSpinner /> : 'Go'}
              </button>
            </div>
            {addError && (
              <p className="text-xs mt-1.5 px-1" style={{ color: 'var(--error)' }}>{addError}</p>
            )}
          </div>
        )}

        {/* Search filter */}
        {repos.filter(r => r.status === 'ready').length > 2 && (
          <div className="relative mb-2">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--fg-subtle)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter repos…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none transition-all"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
        )}

        {ready.length === 0 && processing.length === 0 && (
          <div className="px-2 py-4 text-center">
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>No repos yet.</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>Paste a URL above to start.</p>
          </div>
        )}

        {/* Processing repos */}
        {processing.map((r) => (
          <div
            key={r.id}
            className="w-full px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--warning)' }} />
              <span className="text-xs font-medium truncate" style={{ color: 'var(--fg-secondary)' }}>{r.name}</span>
            </div>
            <p className="text-xs ml-3.5" style={{ color: 'var(--fg-muted)' }}>Indexing…</p>
          </div>
        ))}

        {/* Ready repos */}
        {ready.map((r) => {
          const isActive = activeRepoId === r.id
          const isSelected = selectedRepos.has(r.id)
          return (
            <button
              key={r.id}
              onClick={() => compareMode ? toggleRepoSelection(r.id) : onSelectRepo(r.id, r.name)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all group"
              style={{
                background: compareMode
                  ? isSelected ? 'var(--bg-elevated)' : 'transparent'
                  : isActive ? 'var(--bg-elevated)' : 'transparent',
                border: compareMode
                  ? isSelected ? '1px solid var(--brand)' : '1px solid transparent'
                  : isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!(compareMode ? isSelected : isActive)) {
                  e.currentTarget.style.background = 'var(--bg-surface)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }
              }}
              onMouseLeave={(e) => {
                if (!(compareMode ? isSelected : isActive)) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                {compareMode ? (
                  <span
                    className="w-4 h-4 rounded-md border flex items-center justify-center text-xs shrink-0 transition-all"
                    style={{
                      borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                      background: isSelected ? 'var(--brand)' : 'transparent',
                      color: 'white',
                    }}
                  >
                    {isSelected && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3"/>
                      </svg>
                    )}
                  </span>
                ) : (
                  <span className="text-xs shrink-0">📁</span>
                )}
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--fg)' }}>{r.name}</span>
                {isActive && !compareMode && (
                  <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
                )}
              </div>
              <p className="text-xs ml-5 truncate" style={{ color: 'var(--fg-muted)' }}>
                {r.owner} · {r.fileCount ?? 0}f · {r.commitCount ?? 0}c
              </p>
              {!compareMode && (
                <div className="ml-5 mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ReIngestButton repoId={r.id} onDone={fetchRepos} />
                  <DeleteRepoButton repoId={r.id} repoName={r.name} onDeleted={fetchRepos} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Chat history */}
      <ChatHistory onRestoreSession={onRestoreSession} />

      {/* Indexing progress indicator in sidebar */}
      {addingRepo && (
        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-end gap-0.5 h-4 shrink-0">
              {[10, 6, 14, 8, 12].map((h, i) => (
                <span key={i} className="wave-bar" style={{ height: `${h}px`, background: 'var(--brand-gradient)' }} />
              ))}
            </div>
            <span className="text-xs font-medium truncate" style={{ color: 'var(--fg-secondary)' }}>
              Indexing…
            </span>
          </div>
          {addError && (
            <p className="text-xs mt-1 px-1" style={{ color: 'var(--error)' }}>{addError}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className="px-3 py-3 border-t flex items-center gap-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--brand)' }}
        >
          {username[0]?.toUpperCase()}
        </div>
        <span className="text-xs flex-1 truncate font-medium" style={{ color: 'var(--fg-secondary)' }}>{username}</span>
        <ThemeToggle />
        <button
          onClick={() => signOut()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'
            e.currentTarget.style.color = 'var(--error)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--fg-muted)'
          }}
          title="Sign out"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {/* GitHub repo picker modal — fixed overlay, breaks out of sidebar */}
      {showGitHubPicker && (
        <GitHubRepoPickerModal
          onClose={() => setShowGitHubPicker(false)}
          onSelectRepo={(url, name) => {
            setShowGitHubPicker(false)
            ingestFromUrl(url, name)
          }}
        />
      )}
    </div>
  )
}

function AddingSpinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="9" y="2" width="2" height="4.5" rx="1" fill="white" opacity={0.15 + i * 0.11} transform={`rotate(${i * 45} 10 10)`} />
      ))}
    </svg>
  )
}
