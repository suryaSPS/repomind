'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import RepoInput from '@/components/RepoInput'
import ChatInterface from '@/components/ChatInterface'
import ErrorBoundary from '@/components/ErrorBoundary'

interface MainAppProps {
  username: string
}

export default function MainApp({ username }: MainAppProps) {
  const [activeRepo, setActiveRepo] = useState<{ id: number; name: string } | null>(null)
  const [multiRepo, setMultiRepo] = useState<{ ids: number[]; names: string[] } | null>(null)
  const [restoredSessionId, setRestoredSessionId] = useState<number | null>(null)

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
  }

  function handleRestoreSession(sessionId: number, repoId: number, repoName: string) {
    setMultiRepo(null)
    setRestoredSessionId(sessionId)
    setActiveRepo({ id: repoId, name: repoName })
  }

  function handleMultiRepoChat(repoIds: number[], repoNames: string[]) {
    setRestoredSessionId(null)
    setActiveRepo({ id: repoIds[0], name: repoNames.join(' + ') })
    setMultiRepo({ ids: repoIds, names: repoNames })
  }

  function handleGoHome() {
    setActiveRepo(null)
    setMultiRepo(null)
    setRestoredSessionId(null)
  }

  const isActive = activeRepo || multiRepo

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <Sidebar
        activeRepoId={activeRepo?.id ?? null}
        onSelectRepo={handleSelectRepo}
        onRestoreSession={handleRestoreSession}
        onAddRepo={() => {}}
        onGoHome={handleGoHome}
        onMultiRepoChat={handleMultiRepoChat}
        username={username}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
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
          />
        ) : (
          <EmptyState onRepoReady={handleRepoReady} />
        )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

function EmptyState({ onRepoReady }: { onRepoReady: (id: number, name: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute pointer-events-none morph-blob"
        style={{ width: 600, height: 600, top: '10%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)', borderRadius: '50%', filter: 'blur(60px)' }}
      />

      <div className="text-center max-w-lg mb-10 relative z-10">
        <div className="relative inline-flex mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
            style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <span
              className="absolute inset-0 rounded-3xl"
              style={{ animation: 'pulse-ring 3s ease-out infinite', border: '2px solid var(--brand)', borderRadius: 'inherit', opacity: 0.5 }}
            />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--fg)' }}>
          Your AI{' '}
          <span className="gradient-text">Code Archaeologist</span>
        </h2>
        <p className="text-base leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          Paste any public GitHub repo. RepoMind indexes the full codebase and git history so
          you can ask questions, trace bugs, and understand decisions — with cited file and line references.
        </p>
      </div>

      <div className="w-full max-w-xl relative z-10">
        <RepoInput onRepoReady={onRepoReady} />
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center mt-8 max-w-lg relative z-10">
        {[
          { label: 'File + line citations' },
          { label: 'Git history tracing' },
          { label: 'Semantic code search' },
          { label: 'Claude Haiku agent' },
          { label: 'Streaming answers' },
          { label: 'Multi-repo compare' },
        ].map(({ label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--fg-muted)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--brand)' }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
