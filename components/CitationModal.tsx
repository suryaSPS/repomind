'use client'

import { useEffect, useState, useCallback } from 'react'

interface CitationModalProps {
  citation: string       // e.g. "src/auth/jwt.ts:45-67"
  repoId: number
  onClose: () => void
}

export default function CitationModal({ citation, repoId, onClose }: CitationModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Parse "src/auth/jwt.ts:45-67" → { filePath, lineStart, lineEnd }
  const match = citation.match(/^(.+):(\d+)(?:-(\d+))?$/)
  const filePath = match?.[1] ?? citation
  const lineStart = match?.[2] ? Number(match[2]) : null
  const lineEnd = match?.[3] ? Number(match[3]) : lineStart

  useEffect(() => {
    fetch(`/api/file?repoId=${repoId}&filePath=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setContent(d.content)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load file'); setLoading(false) })
  }, [filePath, repoId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const lines = content?.split('\n') ?? []
  const highlightStart = lineStart ? lineStart - 1 : 0
  const highlightEnd = lineEnd ? lineEnd - 1 : highlightStart

  const ext = filePath.split('.').pop() ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#0d0d1a', border: '1px solid #1e1e2e' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: '#1e1e2e' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">📄</span>
            <span className="text-sm font-mono text-slate-300 truncate">{filePath}</span>
            {lineStart && (
              <span
                className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{ background: '#1e1e3a', color: '#818cf8' }}
              >
                :{lineStart}{lineEnd !== lineStart ? `–${lineEnd}` : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors ml-3 shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              Loading…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-16 text-red-400 text-sm">
              {error}
            </div>
          )}
          {content && (
            <div className="text-xs font-mono">
              {lines.map((line, i) => {
                const lineNum = i + 1
                const isHighlighted = lineNum >= highlightStart + 1 && lineNum <= highlightEnd + 1
                return (
                  <div
                    key={i}
                    className="flex"
                    style={{
                      background: isHighlighted ? 'rgba(99,102,241,0.15)' : 'transparent',
                      borderLeft: isHighlighted ? '2px solid #6366f1' : '2px solid transparent',
                    }}
                  >
                    <span
                      className="select-none w-12 shrink-0 text-right pr-4 py-0.5"
                      style={{ color: isHighlighted ? '#818cf8' : '#374151' }}
                    >
                      {lineNum}
                    </span>
                    <span
                      className="flex-1 py-0.5 pr-4 whitespace-pre"
                      style={{ color: isHighlighted ? '#e2e8f0' : '#94a3b8' }}
                    >
                      {line}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
