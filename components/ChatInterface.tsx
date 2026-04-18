'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from 'ai/react'
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
  const [inputFocused, setInputFocused] = useState(false)

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
      {/* Header / repo badge */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--brand)' }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg)' }}>{displayName}</p>
          {isMultiRepo && (
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{repoIds!.length} repositories</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMultiRepo && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              multi-repo
            </span>
          )}
          <ExportChatButton messages={messages} repoName={displayName} />
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            indexed
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative"
              style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span
                className="absolute inset-0 rounded-2xl"
                style={{ animation: 'pulse-ring 3s ease-out infinite', border: '2px solid var(--brand)', borderRadius: 'inherit', opacity: 0.5 }}
              />
            </div>
            <h3 className="text-lg font-semibold mb-1.5" style={{ color: 'var(--fg)' }}>
              Ask anything about{' '}
              <span className="gradient-text">{displayName}</span>
            </h3>
            <p className="text-sm mb-7 max-w-sm" style={{ color: 'var(--fg-muted)' }}>
              Trace bugs, explain decisions, find patterns, and onboard in seconds — with cited file and line references.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {(isMultiRepo ? MULTI_REPO_QUESTIONS : SINGLE_REPO_QUESTIONS).map((q) => (
                <button
                  key={q}
                  onClick={() => useStarterQuestion(q)}
                  className="text-xs px-3.5 py-2 rounded-xl border text-left transition-all"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--fg-muted)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand)'
                    e.currentTarget.style.color = 'var(--brand)'
                    e.currentTarget.style.background = 'var(--bg-elevated)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--fg-muted)'
                    e.currentTarget.style.background = 'var(--bg-surface)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          let content = m.content
          if (m.role === 'assistant' && 'parts' in m && Array.isArray(m.parts)) {
            const textParts = m.parts.filter(
              (p: { type: string }) => p.type === 'text'
            )
            const hasToolCalls = m.parts.some(
              (p: { type: string }) => p.type === 'tool-invocation'
            )
            if (hasToolCalls && textParts.length > 1) {
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

        {isLoading && <ThinkingIndicator />}

        {error && (
          <div
            className="text-sm px-4 py-3 rounded-xl flex items-center gap-2"
            style={{ background: 'var(--error-bg)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--error)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error.message}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="p-4 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={`Ask anything about ${displayName}… (Enter to send, Shift+Enter for newline)`}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-[160px] text-sm py-3 px-4 rounded-xl outline-none transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${inputFocused ? 'var(--brand)' : 'var(--border)'}`,
              color: 'var(--fg)',
              boxShadow: inputFocused ? '0 0 0 3px var(--brand-glow-sm)' : 'none',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-all btn-glow"
            style={{
              background: isLoading || !input.trim()
                ? 'var(--bg-elevated)'
                : 'var(--brand-gradient)',
              color: isLoading || !input.trim() ? 'var(--fg-subtle)' : 'white',
              border: 'none',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <svg width="14" height="14" viewBox="0 0 20 20" style={{ animation: 'spin 0.9s linear infinite' }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <rect key={i} x="9" y="2" width="2" height="5" rx="1" fill="currentColor" opacity={0.15 + i * 0.11} transform={`rotate(${i * 45} 10 10)`} />
                ))}
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </form>
        <div className="flex items-center justify-between mt-2">
          <ShortcutHint />
          <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            Always verify with cited sources.
          </p>
        </div>
      </div>
    </div>
  )
}
