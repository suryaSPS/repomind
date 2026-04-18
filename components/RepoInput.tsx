'use client'

import { useState } from 'react'

interface IngestionProgress {
  stage: string
  percent: number
  detail?: string
  repoId?: number
  error?: string
}

interface RepoInputProps {
  onRepoReady: (repoId: number, repoName: string) => void
}

const STAGE_ICONS: Record<string, string> = {
  'Starting…': '🚀',
  cloning: '📥',
  indexing: '🔍',
  embedding: '🧠',
  done: '✅',
  error: '❌',
}

export default function RepoInput({ onRepoReady }: RepoInputProps) {
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<IngestionProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [focused, setFocused] = useState(false)

  async function handleIngest() {
    if (!url.trim() || isLoading) return

    setIsLoading(true)
    setProgress({ stage: 'Starting…', percent: 0 })

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) {
        const text = await res.text()
        setProgress({ stage: 'error', percent: 0, error: text })
        setIsLoading(false)
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
              const data: IngestionProgress = JSON.parse(line.slice(6))
              setProgress(data)

              if (data.stage === 'done' && data.repoId) {
                const name = url.trim().split('/').at(-1) ?? 'repo'
                setIsLoading(false)
                onRepoReady(data.repoId, name)
                return
              }

              if (data.stage === 'error') {
                setIsLoading(false)
                return
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setProgress({
        stage: 'error',
        percent: 0,
        error: err instanceof Error ? err.message : 'Network error',
      })
    }

    setIsLoading(false)
  }

  const isError = progress?.stage === 'error'

  return (
    <div className="w-full">
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          {/* GitHub icon */}
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fg-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="https://github.com/owner/repo"
            disabled={isLoading}
            className="w-full pl-10 pr-4 h-12 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${focused ? 'var(--brand)' : 'var(--border)'}`,
              color: 'var(--fg)',
              boxShadow: focused ? '0 0 0 3px var(--brand-glow-sm)' : 'none',
            }}
          />
        </div>
        <button
          onClick={handleIngest}
          disabled={isLoading || !url.trim()}
          className="h-12 px-6 rounded-xl font-semibold text-sm shrink-0 transition-all btn-glow"
          style={{
            background: isLoading || !url.trim()
              ? 'var(--bg-elevated)'
              : 'var(--brand-gradient)',
            color: isLoading || !url.trim() ? 'var(--fg-muted)' : 'white',
            border: 'none',
            cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <SegmentSpinner />
              Indexing
            </span>
          ) : (
            'Analyze →'
          )}
        </button>
      </div>

      {/* Progress */}
      {progress && !isError && (
        <div className="mt-4 expand-in">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">
                {STAGE_ICONS[progress.stage] ?? '⚙️'}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--fg-secondary)' }}>
                {progress.stage}
              </span>
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>
              {progress.detail ? (
                <span className="truncate max-w-[180px] block text-right">{progress.detail}</span>
              ) : `${progress.percent}%`}
            </span>
          </div>
          {/* Unique scan-container progress bar */}
          <div
            className="h-2 rounded-full overflow-hidden relative scan-container"
            style={{ background: 'var(--bg-muted)' }}
          >
            {progress.percent > 0 && progress.percent < 100 && (
              <div className="scan-line" />
            )}
            <div
              className="h-full rounded-full transition-all duration-700 progress-bar-glow"
              style={{ width: `${Math.max(progress.percent, 2)}%` }}
            />
          </div>
          {/* Stage dots */}
          <div className="flex justify-between mt-2">
            {['clone', 'parse', 'embed', 'index', 'done'].map((s, i) => (
              <span key={s} className="text-xs" style={{ color: progress.percent >= i * 25 ? 'var(--brand)' : 'var(--fg-subtle)' }}>
                ●
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="mt-3 text-sm flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl expand-in"
          style={{
            background: 'var(--error-bg)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: 'var(--error)',
          }}
        >
          <div className="flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{progress?.error ?? 'Something went wrong'}</span>
          </div>
          <button
            onClick={handleIngest}
            className="shrink-0 text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
            style={{
              border: '1px solid rgba(248,113,113,0.3)',
              color: 'var(--error)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--error-bg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

function SegmentSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" style={{ animation: 'spin 0.9s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="9" y="2" width="2" height="5" rx="1" fill="white" opacity={0.15 + i * 0.11} transform={`rotate(${i * 45} 10 10)`} />
      ))}
    </svg>
  )
}
