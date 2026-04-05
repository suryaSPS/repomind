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
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-lg mb-10">
        <div
          className="inline-flex w-20 h-20 rounded-3xl items-center justify-center text-4xl mb-6"
          style={{ background: 'linear-gradient(135deg, #1e1e3a, #2d1f52)' }}
        >
          🔍
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">Your AI Code Archaeologist</h2>
        <p className="text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Paste any public GitHub repo. RepoMind indexes the full codebase and git history so
          you can ask questions, trace bugs, and understand decisions — with cited file and line
          references.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <RepoInput onRepoReady={onRepoReady} />
      </div>

      <div className="flex flex-wrap gap-3 justify-center mt-8 max-w-lg">
        {[
          { icon: '📄', label: 'File + line citations' },
          { icon: '🔖', label: 'Git history tracing' },
          { icon: '🔍', label: 'Semantic code search' },
          { icon: '🤖', label: 'Claude Haiku agent' },
          { icon: '⚡', label: 'Streaming answers' },
          { icon: '🔀', label: 'Multi-repo compare' },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
            style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
