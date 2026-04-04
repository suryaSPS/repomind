'use client'

import { useState } from 'react'
import CitationModal from './CitationModal'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  username?: string
  repoId?: number
}

// Regex to find citations like `src/auth/jwt.ts:45-67` or `src/auth/jwt.ts:45`
const CITATION_REGEX = /`([^`]+\.[a-z]+:\d+(?:-\d+)?)`/g

// Process inline markdown: bold, inline code, and citations
function processInline(text: string, keyPrefix: string, repoId?: number): React.ReactNode[] {
  // Match bold (**text**), inline code (`code`), and ❌/✅ markers
  const tokenRegex = /\*\*(.*?)\*\*|`([^`]+)`|([❌✅])/g
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = tokenRegex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))

    if (m[1] !== undefined) {
      // Bold
      parts.push(<strong key={`${keyPrefix}-b-${m.index}`} className="text-indigo-300 font-semibold">{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      // Inline code — check if it's a file citation
      const isCitation = /[^`]+\.[a-z]+:\d+/.test(m[2])
      if (isCitation) {
        parts.push(<CitationChip key={`${keyPrefix}-cite-${m.index}`} citation={m[2]} repoId={repoId} />)
      } else {
        parts.push(
          <code key={`${keyPrefix}-ic-${m.index}`} className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono">
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

// Render markdown-lite: code blocks, headings, lists, paragraphs with bold/code/citations
function renderContent(content: string, repoId?: number) {
  // Split by code blocks first
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
      <pre key={`code-${blockMatch.index}`} className="my-3 text-sm overflow-x-auto bg-slate-900 rounded-lg p-3">
        <code className={`language-${blockMatch[1]}`}>{blockMatch[2]}</code>
      </pre>
    )
    lastIndex = blockMatch.index + blockMatch[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)

    // Split into lines, then process each line by type
    const lines = remaining.split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      // Empty line — skip
      if (!trimmed) { i++; continue }

      // Heading
      if (/^#{1,3}\s/.test(trimmed)) {
        const level = trimmed.match(/^(#+)/)?.[1].length ?? 1
        const text = trimmed.replace(/^#+\s/, '')
        const sizes = ['text-xl', 'text-lg', 'text-base']
        parts.push(
          <p key={`h-${i}`} className={`${sizes[Math.min(level - 1, 2)]} font-semibold text-white mt-4 mb-1`}>
            {processInline(text, `h-${i}`, repoId)}
          </p>
        )
        i++
        continue
      }

      // Unordered list — collect consecutive list items
      if (/^[-*]\s/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s/, ''))
          i++
        }
        parts.push(
          <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-slate-300">
            {items.map((item, j) => (
              <li key={j}>{processInline(item, `li-${i}-${j}`, repoId)}</li>
            ))}
          </ul>
        )
        continue
      }

      // Ordered list — collect consecutive numbered items
      if (/^\d+\.\s/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
          i++
        }
        parts.push(
          <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-slate-300">
            {items.map((item, j) => (
              <li key={j}>{processInline(item, `oli-${i}-${j}`, repoId)}</li>
            ))}
          </ol>
        )
        continue
      }

      // Regular paragraph — collect consecutive non-special lines
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
          <p key={`p-${i}`} className="my-1.5 text-slate-200 leading-relaxed">
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
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono mx-0.5 transition-all"
        style={{
          background: '#1e1e3a',
          color: '#818cf8',
          border: '1px solid #3730a3',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2d2d5a'
          e.currentTarget.style.borderColor = '#6366f1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#1e1e3a'
          e.currentTarget.style.borderColor = '#3730a3'
        }}
      >
        <span>📄</span>
        <span>{citation}</span>
        {copied && <span className="text-green-400">✓</span>}
        {repoId && <span className="text-indigo-400 opacity-60">↗</span>}
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
          className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 fade-in">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        🔍
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1 font-medium">RepoMind</p>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
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
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        🔍
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
          </div>
          <span className="text-xs text-slate-500">Thinking...</span>
        </div>
      </div>
    </div>
  )
}
