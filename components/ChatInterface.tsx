'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import MessageBubble, { ThinkingIndicator } from './MessageBubble'
import ExportChatButton from './ExportChatButton'
import ShortcutHint from './ShortcutHint'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface ChatInterfaceProps {
  repoId: number
  repoName: string
  repoIds?: number[]
  repoNames?: string[]
  username: string
  initialSessionId?: number | null
}

const SINGLE_REPO_QUESTIONS = [
  'How is authentication implemented?',
  'What are the main entry points of this app?',
  'Explain the folder structure and architecture',
  'What database is used and how is it accessed?',
  'Find all API endpoints and what they do',
]

const MULTI_REPO_QUESTIONS = [
  'Compare the tech stacks of these repos',
  'How does authentication differ between them?',
  'What patterns or libraries do they share?',
  'Compare the folder structure and architecture',
  'Which repo has better test coverage?',
]

export default function ChatInterface({ repoId, repoName, repoIds, repoNames, username, initialSessionId }: ChatInterfaceProps) {
  const isMultiRepo = repoIds && repoIds.length > 1
  const displayName = isMultiRepo ? repoNames!.join(' + ') : repoName
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId ?? null)
  const [restoredMessages, setRestoredMessages] = useState<
    { id: string; role: 'user' | 'assistant'; content: string }[]
  >([])

  // Load prior messages when restoring a session
  useEffect(() => {
    if (!initialSessionId) return
    fetch(`/api/sessions/${initialSessionId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setRestoredMessages(
            data.messages.map((m: { id: number; role: string; content: string }) => ({
              id: String(m.id),
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          )
        }
      })
  }, [initialSessionId])

  const { messages: liveMessages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: isMultiRepo ? { repoIds, sessionId } : { repoId, sessionId },
    onResponse(response: Response) {
      const sid = response.headers.get('X-Session-Id')
      if (sid) setSessionId(Number(sid))
    },
  })

  // Combine restored + live messages, avoiding duplicates
  const messages = [
    ...restoredMessages,
    ...liveMessages.filter((m) => !restoredMessages.some((r) => r.id === m.id)),
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useKeyboardShortcuts({
    onFocusInput: () => textareaRef.current?.focus(),
    onNewChat: () => {
      setSessionId(null)
      window.location.reload()
    },
    onEscape: () => {
      if (document.activeElement === textareaRef.current) {
        textareaRef.current?.blur()
      }
    },
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
      }
    }
  }

  function useStarterQuestion(q: string) {
    handleInputChange({ target: { value: q } } as React.ChangeEvent<HTMLTextAreaElement>)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Repo badge */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs"
          style={{ background: '#1e1e3a' }}
        >
          📁
        </div>
        <span className="text-sm font-medium text-white truncate">{displayName}</span>
        {isMultiRepo && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1e1b4b', color: '#a5b4fc' }}>
            {repoIds!.length} repos
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ExportChatButton messages={messages} repoName={displayName} />
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#14532d', color: '#4ade80' }}
          >
            indexed
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: 'linear-gradient(135deg, #1e1e3a, #2d1f52)' }}
            >
              🔍
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Ask anything about{' '}
              <span className="text-indigo-400">{displayName}</span>
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              I can trace bugs, explain decisions, find patterns, and onboard you in seconds.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {(isMultiRepo ? MULTI_REPO_QUESTIONS : SINGLE_REPO_QUESTIONS).map((q) => (
                <button
                  key={q}
                  onClick={() => useStarterQuestion(q)}
                  className="text-xs px-3 py-2 rounded-full border transition-colors text-left"
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.color = '#a5b4fc'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--muted-foreground)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          // For assistant messages with tool calls, only show the final text
          // (skip intermediate "I'll search for..." planning text)
          let content = m.content
          if (m.role === 'assistant' && 'parts' in m && Array.isArray(m.parts)) {
            const textParts = m.parts.filter(
              (p: { type: string }) => p.type === 'text'
            )
            const hasToolCalls = m.parts.some(
              (p: { type: string }) => p.type === 'tool-invocation'
            )
            if (hasToolCalls && textParts.length > 1) {
              // Use only the last text part (the final answer)
              content = (textParts[textParts.length - 1] as { type: string; text: string }).text
            } else if (hasToolCalls && textParts.length === 1) {
              content = (textParts[0] as { type: string; text: string }).text
            }
          }

          if (!content?.trim()) return null

          return (
            <MessageBubble
              key={m.id}
              role={m.role as 'user' | 'assistant'}
              content={content}
              username={username}
              repoId={repoId}
            />
          )
        })}

        {isLoading && (
          <ThinkingIndicator />
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            Error: {error.message}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="p-4 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Ask anything about ${displayName}… (Enter to send, Shift+Enter for newline)`}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-[160px] text-sm py-3"
            style={{
              background: '#0a0a0f',
              border: '1px solid var(--border)',
              color: 'white',
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-11 w-11 shrink-0 p-0 flex items-center justify-center"
            style={{
              background:
                isLoading || !input.trim()
                  ? '#2d2d44'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
            }}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </Button>
        </form>
        <div className="flex items-center justify-between mt-2">
          <ShortcutHint />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Always verify with cited sources.
          </p>
        </div>
      </div>
    </div>
  )
}
