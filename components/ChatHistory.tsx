'use client'

import { useEffect, useState } from 'react'

interface ChatSessionItem {
  id: number
  repoId: number
  repoName: string
  repoOwner: string
  createdAt: string
}

interface ChatHistoryProps {
  onRestoreSession: (sessionId: number, repoId: number, repoName: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ChatHistory({ onRestoreSession }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
  }, [open])

  if (sessions.length === 0) return null

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
      >
        <span className="font-medium">RECENT CHATS</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onRestoreSession(s.id, s.repoId, s.repoName)}
              className="w-full text-left px-2 py-2 rounded-lg transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: 'var(--fg-secondary)' }}>
                  {s.repoName}
                </span>
                <span className="text-xs shrink-0 ml-1" style={{ color: 'var(--muted-foreground)' }}>
                  {timeAgo(s.createdAt)}
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                {s.repoOwner}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
