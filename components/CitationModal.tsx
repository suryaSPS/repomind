'use client'

import { useEffect, useState, useCallback } from 'react'

interface CitationModalProps {
  citation: string
  repoId: number
  onClose: () => void
}

export default function CitationModal({ citation, repoId, onClose }: CitationModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const lines = content?.split('\n') ?? []
  const highlightStart = lineStart ? lineStart - 1 : 0
  const highlightEnd = lineEnd ? lineEnd - 1 : highlightStart

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl overflow-hidden expand-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--fg-muted)', flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span
              className="text-sm font-mono truncate"
              style={{ color: 'var(--fg-secondary)' }}
            >
              {filePath}
            </span>
            {lineStart && (
              <span
                className="text-xs px-2 py-0.5 rounded-md shrink-0 font-mono"
                style={{ background: 'var(--brand-glow-sm)', color: 'var(--brand)', border: '1px solid var(--brand-glow)' }}
              >
                :{lineStart}{lineEnd !== lineStart ? `–${lineEnd}` : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 text-xl leading-none transition-colors"
            style={{ color: 'var(--fg-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)' }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-input)' }}>
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--fg-muted)' }}>
              Loading…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--error)' }}>
              {error}
            </div>
          )}
          {content && (
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-geist-mono, monospace)' }}>
              {lines.map((line, i) => {
                const lineNum = i + 1
                const isHighlighted = lineNum >= highlightStart + 1 && lineNum <= highlightEnd + 1
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      background: isHighlighted ? 'var(--brand-glow-sm)' : 'transparent',
                      borderLeft: isHighlighted ? '2px solid var(--brand)' : '2px solid transparent',
                    }}
                  >
                    <span
                      style={{
                        userSelect: 'none',
                        width: 44,
                        flexShrink: 0,
                        textAlign: 'right',
                        paddingRight: 14,
                        paddingTop: 2,
                        paddingBottom: 2,
                        color: isHighlighted ? 'var(--brand)' : 'var(--fg-subtle)',
                      }}
                    >
                      {lineNum}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        paddingTop: 2,
                        paddingBottom: 2,
                        paddingRight: 16,
                        whiteSpace: 'pre',
                        color: isHighlighted ? 'var(--fg)' : 'var(--fg-muted)',
                      }}
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
