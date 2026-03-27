'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export default function RepoInput({ onRepoReady }: RepoInputProps) {
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<IngestionProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

      // Parse SSE stream
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: IngestionProgress = JSON.parse(line.slice(6))
              setProgress(data)

              if (data.stage === 'done' && data.repoId) {
                // Extract repo name from URL
                const name = url.trim().split('/').at(-1) ?? 'repo'
                setIsLoading(false)
                onRepoReady(data.repoId, name)
                return
              }

              if (data.stage === 'error') {
                setIsLoading(false)
                return
              }
            } catch {
              // skip malformed SSE lines
            }
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            🐙
          </span>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
            placeholder="https://github.com/owner/repo"
            disabled={isLoading}
            className="pl-9 pr-4 h-11 text-sm"
            style={{
              background: '#0a0a0f',
              border: '1px solid var(--border)',
              color: 'white',
            }}
          />
        </div>
        <Button
          onClick={handleIngest}
          disabled={isLoading || !url.trim()}
          className="h-11 px-5 font-medium shrink-0"
          style={{
            background: isLoading
              ? '#2d2d44'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Indexing
            </span>
          ) : (
            'Analyze'
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {progress && !isError && (
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-400">{progress.stage}</span>
            <span className="text-xs text-slate-500">
              {progress.detail ?? `${progress.percent}%`}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e2e' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress.percent}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="mt-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
          {progress?.error ?? 'Something went wrong'}
        </div>
      )}
    </div>
  )
}
