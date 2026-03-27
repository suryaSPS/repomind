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

// Render markdown-lite: bold, code, citations
function renderContent(content: string, repoId?: number) {
  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockMatch: RegExpExecArray | null

  const processInline = (text: string, key: string): React.ReactNode => {
    // Handle bold
    const boldRegex = /\*\*(.*?)\*\*/g
    const inlineParts: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null

    while ((m = boldRegex.exec(text)) !== null) {
      if (m.index > last) inlineParts.push(text.slice(last, m.index))
      inlineParts.push(<strong key={m.index} className="text-indigo-300 font-semibold">{m[1]}</strong>)
      last = m.index + m[0].length
    }
    if (last < text.length) inlineParts.push(text.slice(last))

    return <span key={key}>{inlineParts}</span>
  }

  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    if (blockMatch.index > lastIndex) {
      const before = content.slice(lastIndex, blockMatch.index)
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {processInline(before, `inline-${lastIndex}`)}
        </span>
      )
    }
    parts.push(
      <pre key={`code-${blockMatch.index}`} className="my-3 text-sm overflow-x-auto">
        <code className={`language-${blockMatch[1]}`}>{blockMatch[2]}</code>
      </pre>
    )
    lastIndex = blockMatch.index + blockMatch[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)

    // Process paragraph breaks
    const paragraphs = remaining.split('\n\n')
    paragraphs.forEach((para, i) => {
      if (para.startsWith('# ') || para.startsWith('## ') || para.startsWith('### ')) {
        const level = para.match(/^(#+)/)?.[1].length ?? 1
        const text = para.replace(/^#+\s/, '')
        const sizes = ['text-xl', 'text-lg', 'text-base']
        parts.push(
          <p key={`h-${i}`} className={`${sizes[Math.min(level - 1, 2)]} font-semibold text-white mt-4 mb-1`}>
            {text}
          </p>
        )
      } else if (para.startsWith('- ') || para.startsWith('* ')) {
        const lines = para.split('\n').filter(Boolean)
        parts.push(
          <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-slate-300">
            {lines.map((line, j) => (
              <li key={j}>{line.replace(/^[-*]\s/, '')}</li>
            ))}
          </ul>
        )
      } else if (para.trim()) {
        // Inline code + citations
        const inlineCodeRegex = /`([^`]+)`/g
        const lineParts: React.ReactNode[] = []
        let lLast = 0
        let lm: RegExpExecArray | null

        while ((lm = inlineCodeRegex.exec(para)) !== null) {
          if (lm.index > lLast) {
            lineParts.push(
              <span key={`t-${lLast}`} className="whitespace-pre-wrap">
                {processInline(para.slice(lLast, lm.index), `il-${lLast}`)}
              </span>
            )
          }
          // Check if it's a file citation (has colon + number)
          const isCitation = /[^`]+\.[a-z]+:\d+/.test(lm[1])
          if (isCitation) {
            parts.push(
              <CitationChip key={`cite-${lm.index}`} citation={lm[1]} repoId={repoId} />
            )
          } else {
            lineParts.push(
              <code key={`ic-${lm.index}`} className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono">
                {lm[1]}
              </code>
            )
          }
          lLast = lm.index + lm[0].length
        }

        if (lLast < para.length) {
          lineParts.push(
            <span key={`tl-${lLast}`} className="whitespace-pre-wrap">
              {processInline(para.slice(lLast), `tle-${lLast}`)}
            </span>
          )
        }

        parts.push(
          <p key={`p-${i}`} className="my-1.5 text-slate-200 leading-relaxed">
            {lineParts}
          </p>
        )
      }
    })
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

export function TypingIndicator() {
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
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 typing-dot" />
        </div>
      </div>
    </div>
  )
}
