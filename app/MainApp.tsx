'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import RepoInput from '@/components/RepoInput'
import ChatInterface from '@/components/ChatInterface'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useQuickStart } from '@/hooks/useQuickStart'

interface MainAppProps {
  username: string
  userId: string
}

export default function MainApp({ username, userId }: MainAppProps) {
  const tutorial = useQuickStart(userId)
  const [activeRepo, setActiveRepo] = useState<{ id: number; name: string } | null>(null)
  const [multiRepo, setMultiRepo] = useState<{ ids: number[]; names: string[] } | null>(null)
  const [restoredSessionId, setRestoredSessionId] = useState<number | null>(null)
  // Mobile: sidebar is an off-canvas drawer (static column from `md` up)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleRepoReady(repoId: number, repoName: string) {
    setRestoredSessionId(null)
    setMultiRepo(null)
    setActiveRepo({ id: repoId, name: repoName })
    window.dispatchEvent(new Event('repomind:refresh-repos'))
  }

  function handleSelectRepo(id: number, name: string) {
    setRestoredSessionId(null)
    setMultiRepo(null)
    setActiveRepo({ id, name })
    setSidebarOpen(false)
  }

  function handleRestoreSession(sessionId: number, repoId: number, repoName: string) {
    setMultiRepo(null)
    setRestoredSessionId(sessionId)
    setActiveRepo({ id: repoId, name: repoName })
    setSidebarOpen(false)
  }

  function handleMultiRepoChat(repoIds: number[], repoNames: string[]) {
    setRestoredSessionId(null)
    setActiveRepo({ id: repoIds[0], name: repoNames.join(' + ') })
    setMultiRepo({ ids: repoIds, names: repoNames })
    setSidebarOpen(false)
  }

  function handleGoHome() {
    setActiveRepo(null)
    setMultiRepo(null)
    setRestoredSessionId(null)
    setSidebarOpen(false)
  }

  const isActive = activeRepo || multiRepo

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile, static column from md up */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          activeRepoId={activeRepo?.id ?? null}
          onSelectRepo={handleSelectRepo}
          onRestoreSession={handleRestoreSession}
          onAddRepo={() => {}}
          onGoHome={handleGoHome}
          onMultiRepoChat={handleMultiRepoChat}
          username={username}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — hamburger to open the drawer */}
        <div
          className="md:hidden flex items-center gap-3 px-4 h-14 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 -ml-1.5 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--fg-secondary)' }}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>RepoMind</span>
          </div>
        </div>

        <ErrorBoundary>
        {isActive ? (
          <ChatInterface
            key={multiRepo ? multiRepo.ids.join('-') : (restoredSessionId ?? activeRepo!.id)}
            repoId={multiRepo ? multiRepo.ids[0] : activeRepo!.id}
            repoName={multiRepo ? multiRepo.names.join(' + ') : activeRepo!.name}
            repoIds={multiRepo?.ids}
            repoNames={multiRepo?.names}
            username={username}
            initialSessionId={restoredSessionId}
            tutorial={tutorial.active}
            onTutorialEnd={tutorial.finish}
          />
        ) : (
          <EmptyState onRepoReady={handleRepoReady} tutorial={tutorial.active} onTutorialEnd={tutorial.finish} onRestartTutorial={tutorial.restart} />
        )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

function EmptyState({ onRepoReady, tutorial, onTutorialEnd, onRestartTutorial }: { onRepoReady: (id: number, name: string) => void; tutorial: boolean; onTutorialEnd: () => void; onRestartTutorial: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="text-center max-w-lg mb-10">
        {/* Icon */}
        <div
          className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--fg)' }}>
          Explore any codebase
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          Paste a GitHub repo URL. RepoMind indexes the full codebase and git history so
          you can ask questions, trace bugs, and understand decisions — with cited file and line references.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <RepoInput onRepoReady={onRepoReady} tutorial={tutorial} onTutorialEnd={onTutorialEnd} />
        {!tutorial && <button type="button" onClick={onRestartTutorial} className="block mx-auto mt-3 min-h-11 px-3 text-sm underline underline-offset-4 rounded-lg focus-visible:outline-2" style={{ color: 'var(--fg-secondary)' }}>Replay quick start</button>}
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-8 max-w-lg">
        {['File + line citations', 'Git history tracing', 'Semantic code search', 'Multi-repo compare'].map((label) => (
          <div
            key={label}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--fg-muted)',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
