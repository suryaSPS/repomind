'use client'

import { useState } from 'react'

interface ReIngestButtonProps {
  repoId: number
  onDone?: () => void
}

export default function ReIngestButton({ repoId, onDone }: ReIngestButtonProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  async function handleReIngest() {
    if (loading) return
    setLoading(true)
    setProgress('Starting…')

    const res = await fetch(`/api/repos/${repoId}/reingest`, { method: 'POST' })
    if (!res.ok) { setLoading(false); return }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          setProgress(`${data.stage} ${data.percent ?? ''}%`)
          if (data.stage === 'done' || data.stage === 'error') {
            setLoading(false)
            setProgress(null)
            onDone?.()
            return
          }
        } catch { /* skip */ }
      }
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleReIngest}
      disabled={loading}
      title="Re-index this repo"
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
      style={{
        background: loading ? '#1e1e2e' : 'transparent',
        color: loading ? '#6366f1' : '#64748b',
        border: '1px solid #1e1e2e',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.color = '#a5b4fc'
      }}
      onMouseLeave={(e) => {
        if (!loading) e.currentTarget.style.color = '#64748b'
      }}
    >
      {loading ? (
        <>
          <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span>{progress}</span>
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Re-index
        </>
      )}
    </button>
  )
}
