'use client'

import { useState } from 'react'
import CitationModal from './CitationModal'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  username?: string
  repoId?: number
}

const CITATION_REGEX = /`([^`]+\.[a-z]+:\d+(?:-\d+)?)`/g

function processInline(text: string, keyPrefix: string, repoId?: number): React.ReactNode[] {
  const tokenRegex = /\*\*(.*?)\*\*|`([^`]+)`|([❌✅])/g
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = tokenRegex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))

    if (m[1] !== undefined) {
      parts.push(
        <strong key={`${keyPrefix}-b-${m.index}`} style={{ color: 'var(--fg)', fontWeight: 600 }}>
          {m[1]}
        </strong>
      )
    } else if (m[2] !== undefined) {
      const isCitation = /[^`]+\.[a-z]+:\d+/.test(m[2])
      if (isCitation) {
        parts.push(<CitationChip key={`${keyPrefix}-cite-${m.index}`} citation={m[2]} repoId={repoId} />)
      } else {
        parts.push(
          <code
            key={`${keyPrefix}-ic-${m.index}`}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--brand)',
              padding: '1px 5px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              fontSize: '0.82em',
              fontFamily: 'var(--font-geist-mono, monospace)',
            }}
          >
            {m[2]}
          </code>
        )
      }
    } else {
      parts.push(m[0])
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderContent(content: string, repoId?: number) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    if (blockMatch.index > lastIndex) {
      const before = content.slice(lastIndex, blockMatch.index)
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {processInline(before, `pre-${lastIndex}`, repoId)}
        </span>
      )
    }
    parts.push(
      <pre
        key={`code-${blockMatch.index}`}
        style={{
          margin: '10px 0',
          fontSize: '12.5px',
          overflowX: 'auto',
          background: 'var(--bg-input)',
          borderRadius: '8px',
          padding: '12px 14px',
          border: '1px solid var(--border)',
        }}
      >
        <code className={`language-${blockMatch[1]}`} style={{ color: 'var(--fg-secondary)' }}>
          {blockMatch[2]}
        </code>
      </pre>
    )
    lastIndex = blockMatch.index + blockMatch[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)
    const lines = remaining.split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      if (!trimmed) { i++; continue }

      if (/^[-*_]{3,}$/.test(trimmed)) {
        parts.push(<hr key={`hr-${i}`} style={{ borderColor: 'var(--border)', margin: '14px 0' }} />)
        i++
        continue
      }

      // Table
      if (/^\|.+\|$/.test(trimmed)) {
        const tableLines: string[] = []
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
          tableLines.push(lines[i].trim())
          i++
        }
        if (tableLines.length >= 2) {
          const headerCells = tableLines[0].split('|').filter(Boolean).map(c => c.trim())
          const startRow = /^[-:\s|]+$/.test(tableLines[1]) ? 2 : 1
          const bodyRows = tableLines.slice(startRow).map(row =>
            row.split('|').filter(Boolean).map(c => c.trim())
          )
          parts.push(
            <div key={`table-${i}`} style={{ margin: '10px 0', overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    {headerCells.map((cell, ci) => (
                      <th key={ci} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {processInline(cell, `th-${i}-${ci}`, repoId)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '7px 12px', color: 'var(--fg-secondary)', borderBottom: '1px solid var(--border-muted)' }}>
                          {processInline(cell, `td-${i}-${ri}-${ci}`, repoId)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          continue
        }
      }

      // Heading
      if (/^#{1,3}\s/.test(trimmed)) {
        const level = trimmed.match(/^(#+)/)?.[1].length ?? 1
        const text = trimmed.replace(/^#+\s/, '')
        const sizes = ['1.1rem', '1rem', '0.925rem'] as const
        parts.push(
          <p key={`h-${i}`} style={{ fontSize: sizes[Math.min(level - 1, 2)], fontWeight: 600, color: 'var(--fg)', margin: '14px 0 4px' }}>
            {processInline(text, `h-${i}`, repoId)}
          </p>
        )
        i++
        continue
      }

      // Unordered list
      if (/^[-*]\s/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s/, ''))
          i++
        }
        parts.push(
          <ul key={`ul-${i}`} style={{ listStyleType: 'disc', paddingLeft: '1.25rem', margin: '6px 0', color: 'var(--fg-secondary)' }}>
            {items.map((item, j) => (
              <li key={j} style={{ marginBottom: '3px' }}>{processInline(item, `li-${i}-${j}`, repoId)}</li>
            ))}
          </ul>
        )
        continue
      }

      // Ordered list
      if (/^\d+\.\s/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
          i++
        }
        parts.push(
          <ol key={`ol-${i}`} style={{ listStyleType: 'decimal', paddingLeft: '1.25rem', margin: '6px 0', color: 'var(--fg-secondary)' }}>
            {items.map((item, j) => (
              <li key={j} style={{ marginBottom: '3px' }}>{processInline(item, `oli-${i}-${j}`, repoId)}</li>
            ))}
          </ol>
        )
        continue
      }

      // Paragraph
      const paraLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,3}\s/.test(lines[i].trim()) &&
        !/^[-*]\s/.test(lines[i].trim()) &&
        !/^\d+\.\s/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i])
        i++
      }
      if (paraLines.length > 0) {
        parts.push(
          <p key={`p-${i}`} style={{ margin: '5px 0', color: 'var(--fg-secondary)', lineHeight: 1.7 }}>
            {processInline(paraLines.join('\n'), `p-${i}`, repoId)}
          </p>
        )
      }
    }
  }

  return parts
}

function CitationChip({ citation, repoId }: { citation: string; repoId?: number }) {
  const [copied, setCopied] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  function handleClick() {
    if (repoId) {
      setModalOpen(true)
    } else {
      navigator.clipboard.writeText(citation)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        title={repoId ? `Open ${citation}` : `Copy: ${citation}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '1px 7px',
          borderRadius: '5px',
          fontSize: '11.5px',
          fontFamily: 'var(--font-geist-mono, monospace)',
          margin: '0 2px',
          background: 'var(--bg-surface)',
          color: 'var(--brand)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        {citation}
        {copied && <span style={{ color: 'var(--success)' }}>✓</span>}
        {repoId && !copied && <span style={{ opacity: 0.5 }}>↗</span>}
      </button>
      {modalOpen && repoId && (
        <CitationModal
          citation={citation}
          repoId={repoId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

export default function MessageBubble({ role, content, username, repoId }: MessageBubbleProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end fade-in">
        <div
          style={{
            maxWidth: '75%',
            borderRadius: '16px 16px 4px 16px',
            padding: '10px 14px',
            fontSize: '14px',
            color: 'white',
            background: 'var(--brand)',
            lineHeight: 1.6,
          }}
        >
          <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 fade-in">
      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            borderRadius: '4px 16px 16px 16px',
            padding: '12px 16px',
            fontSize: '14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="prose prose-invert max-w-none">
            {renderContent(content, repoId)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3 fade-in">
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div
        style={{
          borderRadius: '4px 16px 16px 16px',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
            {[16, 10, 20, 12, 18, 8].map((h, i) => (
              <span
                key={i}
                className="wave-bar"
                style={{ height: `${h}px`, background: 'var(--brand)', opacity: 0.8 }}
              />
            ))}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
            Searching codebase…
          </span>
        </div>
      </div>
    </div>
  )
}
